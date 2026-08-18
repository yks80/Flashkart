# FlashKart — High-Concurrency Flash Sale Platform

Node.js · TypeScript · Express · TypeORM · PostgreSQL · Redis

The core idea: **Redis is the authoritative stock counter during a sale; Postgres is the durable source of truth.** The hot path (thousands of concurrent reservations against one product) hits an atomic Redis counter via a Lua script, so overselling is impossible. Postgres is written only at checkout, inside a transaction, and reconciled after the sale.

---

## Project structure

```
flashkart/
├── package.json
├── tsconfig.json
├── docker-compose.yml          # Postgres + Redis for local dev
├── .env.example                # copy to .env
│
├── src/
│   ├── index.ts                # entry point — wires DB, Redis, app, reaper
│   ├── app.ts                  # Express app factory + route mounting
│   ├── enums.ts                # OrderStatus, CartStatus
│   │
│   ├── config/
│   │   ├── env.ts              # typed environment loader
│   │   ├── dataSource.ts       # TypeORM DataSource
│   │   └── redis.ts            # ioredis client
│   │
│   ├── entities/               # A1 — TypeORM entities
│   │   ├── User.ts
│   │   ├── Product.ts          # durable stock + @VersionColumn
│   │   ├── Cart.ts
│   │   ├── CartItem.ts
│   │   └── Order.ts            # unique idempotencyKey (D2 guardrail)
│   │
│   ├── redis/
│   │   ├── redisService.ts     # loads + wraps the Lua scripts
│   │   └── lua/                # A2 — atomic concurrency control
│   │       ├── reserve.lua     # GET + DECRBY in one atomic step
│   │       ├── consume.lua     # lock in a reservation at checkout
│   │       └── release.lua     # return stock (reaper / compensation)
│   │
│   ├── modules/
│   │   ├── reservation/        # A2 — POST /cart/reserve
│   │   │   ├── reservationService.ts
│   │   │   ├── reservationController.ts
│   │   │   └── reservationRoutes.ts
│   │   ├── checkout/           # A3 — POST /order/checkout
│   │   │   ├── checkoutService.ts   # tx + idempotency + compensation
│   │   │   ├── checkoutController.ts
│   │   │   └── checkoutRoutes.ts
│   │   └── payment/
│   │       └── paymentGateway.ts     # interface + stub
│   │
│   ├── reaper/
│   │   └── reservationReaper.ts # reclaims stock from expired reservations
│   │
│   ├── middleware/
│   │   ├── auth.ts             # demo x-user-id auth (swap for JWT)
│   │   ├── validate.ts         # zod body validation
│   │   └── errorHandler.ts     # central AppError → HTTP mapping
│   │
│   ├── common/
│   │   └── errors.ts           # AppError
│   │
│   └── migrations/             # generated TypeORM migrations
│
└── scripts/
    ├── seed.ts                 # create a user + live sale product, warm Redis
    └── loadTest.ts             # fire 200 reservations at stock=100 → no oversell
```

---

## Step-by-step setup

### 1. Prerequisites
- Node.js 20+
- Docker (for Postgres + Redis) — or your own instances

### 2. Install
```bash
npm install
cp .env.example .env
```

### 3. Start Postgres + Redis
```bash
docker compose up -d
```

### 4. Create the schema
Dev (fast): `.env` ships with `DB_SYNCHRONIZE=true`, so tables are auto-created on boot. Nothing to do.

Production (proper): set `DB_SYNCHRONIZE=false`, then:
```bash
npm run migration:generate
npm run migration:run
```

### 5. Run the API
```bash
npm run dev        # ts-node-dev with hot reload
# or
npm run build && npm start
```
Health check: `curl http://localhost:3000/health`

### 6. Seed a demo sale
```bash
npm run seed
# prints USER_ID and PRODUCT_ID — copy them for the requests below
```

---

## Trying the flow

**Reserve stock (5-minute hold):**
```bash
curl -X POST http://localhost:3000/cart/reserve \
  -H "Content-Type: application/json" \
  -H "x-user-id: <USER_ID>" \
  -d '{"productId":"<PRODUCT_ID>","quantity":1}'
# → { "ok": true, "reservationId": "...", "expiresAt": "...", "quantity": 1 }
```

**Checkout (idempotent):**
```bash
curl -X POST http://localhost:3000/order/checkout \
  -H "Content-Type: application/json" \
  -H "x-user-id: <USER_ID>" \
  -H "Idempotency-Key: <ANY_STABLE_UUID>" \
  -d '{"reservationId":"<RESERVATION_ID>"}'
# → { "ok": true, "order": { ... "status": "PAID" } }
```
Repeat the checkout with the **same** `Idempotency-Key` → you get the same order back, no duplicate (D2).

---

## Proving no overselling (D1)

```bash
STOCK=100 N=200 npm run loadtest
```
Fires 200 concurrent reservations at a counter warmed to 100. Output:
```
successful reserve: 100
rejected          : 100
remaining in redis : 0
oversold?          : NO ✅
```
Because each reservation is a single Lua script, Redis runs `GET → compare → DECRBY` with zero interleaving — the classic check-then-act race cannot occur.

---

## How the pieces enforce correctness

| Concern | Mechanism | File |
|---|---|---|
| No overselling | Atomic Lua `GET+DECRBY`; DB guarded `UPDATE ... WHERE stock >= q`; `@VersionColumn` | `lua/reserve.lua`, `checkoutService.ts` |
| Reservation expiry | `reservation:{id}` TTL + `reservations:pending` ZSET reaper | `reservationReaper.ts`, `release.lua` |
| Duplicate orders | Unique `orders.idempotency_key` + pre-check + `consume` state flip | `Order.ts`, `checkoutService.ts`, `consume.lua` |
| Rollback | TypeORM `QueryRunner` transaction; Redis compensation on failure | `checkoutService.ts` |
| Consistency across stores | Consume-first ordering + idempotent compensating release | `checkoutService.ts` |

## Notes / production hardening
- Auth is a demo `x-user-id` header — replace `middleware/auth.ts` with JWT/session verification.
- Payment is a stub — pass the idempotency key through to the real provider.
- Run Redis with AOF (`docker-compose.yml` already does) and reconcile `Product.stock` from PAID orders after each sale.
- Put PgBouncer (transaction pooling) in front of Postgres and use read replicas for catalog reads at scale.
