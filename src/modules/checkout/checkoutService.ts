import { DataSource, QueryFailedError } from 'typeorm';
import { RedisService } from '../../redis/redisService';
import { Order } from '../../entities/Order';
import { OrderStatus } from '../../enums';
import { AppError } from '../../common/errors';
import { PaymentGateway } from '../payment/paymentGateway';

const PG_UNIQUE_VIOLATION = '23505';

export class CheckoutService {
  constructor(
    private readonly ds: DataSource,
    private readonly redis: RedisService,
    private readonly payment: PaymentGateway,
  ) {}

  async checkout(userId: string, reservationId: string, idempotencyKey: string): Promise<Order> {
    // 1. Idempotency fast path: a replayed request returns the same order, no side effects.
    const existing = await this.ds
      .getRepository(Order)
      .findOne({ where: { idempotencyKey } });
    if (existing) return existing;

    // 2. Atomically consume the reservation (also removes it from the reaper ZSET).
    const consumed = await this.redis.consume(reservationId, userId);
    if (typeof consumed === 'number') this.mapConsumeError(consumed);
    const [qty, productId] = consumed as [number, string];

    // 3. Durable write inside a transaction. Postgres is the source of truth.
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // Guarded decrement: DB-level anti-oversell backstop.
      const updated: Array<{ price: string }> = await qr.manager.query(
        `UPDATE products
            SET stock = stock - $1, version = version + 1
          WHERE id = $2 AND stock >= $1
      RETURNING price`,
        [qty, productId],
      );
      if (updated.length === 0) {
        throw new AppError(409, 'DB_STOCK_MISMATCH', 'Stock unavailable at commit.');
      }

      const total = (Number(updated[0].price) * qty).toFixed(2);

      const order = qr.manager.create(Order, {
        userId,
        productId,
        quantity: qty,
        totalAmount: total,
        idempotencyKey,
        reservationId,
        status: OrderStatus.PENDING,
      });
      await qr.manager.save(order);

      // Charge within the tx boundary so a failed payment rolls the order back.
      await this.payment.charge({ idempotencyKey, amount: total, userId });
      order.status = OrderStatus.PAID;
      await qr.manager.save(order);

      await qr.commitTransaction();
      return order;
    } catch (err) {
      await qr.rollbackTransaction();

      // Two concurrent checkouts with the same key: the loser hits the unique
      // constraint. Treat as idempotent success, not an error.
      if (err instanceof QueryFailedError && (err.driverError as any)?.code === PG_UNIQUE_VIOLATION) {
        return this.ds.getRepository(Order).findOneOrFail({ where: { idempotencyKey } });
      }

      // DB failed after we consumed the reservation -> return stock to Redis.
      // The reaper is a backstop if this compensating call itself fails.
      await this.redis.release(reservationId, productId).catch((e) =>
        console.error('[checkout] compensating release failed', e),
      );
      throw err;
    } finally {
      await qr.release();
    }
  }

  private mapConsumeError(code: number): never {
    const map: Record<number, [number, string, string]> = {
      [-1]: [410, 'RESERVATION_EXPIRED', 'Reservation expired or not found.'],
      [-2]: [409, 'ALREADY_CHECKED_OUT', 'This reservation was already used.'],
      [-3]: [410, 'RESERVATION_EXPIRED', 'Reservation window has passed.'],
      [-4]: [403, 'NOT_OWNER', 'Reservation belongs to another user.'],
    };
    const [status, code2, msg] = map[code] ?? [500, 'CHECKOUT_FAILED', 'Unexpected error.'];
    throw new AppError(status, code2, msg);
  }
}
