import Redis from 'ioredis';
import { readFileSync } from 'fs';
import { join } from 'path';

// Resolves lua/ next to this file in both ts-node (src) and compiled (dist) runs.
const lua = (name: string) => readFileSync(join(__dirname, 'lua', name), 'utf8');

// Extend ioredis typing with our custom commands.
declare module 'ioredis' {
  interface RedisCommander<Context> {
    reserveStock(
      stockKey: string,
      resKey: string,
      zset: string,
      qty: number,
      productId: string,
      userId: string,
      expiresAtMs: number,
      reservationId: string,
    ): Promise<number>;

    consumeReservation(
      resKey: string,
      zset: string,
      reservationId: string,
      userId: string,
      nowMs: number,
    ): Promise<number | [number, string]>;

    releaseReservation(
      stockKey: string,
      resKey: string,
      zset: string,
      reservationId: string,
    ): Promise<number>;
  }
}

const PENDING_ZSET = 'reservations:pending';

export class RedisService {
  constructor(private readonly redis: Redis) {
    redis.defineCommand('reserveStock', { numberOfKeys: 3, lua: lua('reserve.lua') });
    redis.defineCommand('consumeReservation', { numberOfKeys: 2, lua: lua('consume.lua') });
    redis.defineCommand('releaseReservation', { numberOfKeys: 3, lua: lua('release.lua') });
  }

  private stockKey = (pid: string) => `stock:${pid}`;
  private resKey = (rid: string) => `reservation:${rid}`;

  /** Warm the live counter from DB at sale start. NX so a restart never clobbers a live count. */
  async warmStock(productId: string, stock: number): Promise<void> {
    await this.redis.set(this.stockKey(productId), stock, 'NX');
  }

  async getStock(productId: string): Promise<number | null> {
    const v = await this.redis.get(this.stockKey(productId));
    return v === null ? null : parseInt(v, 10);
  }

  async reserve(p: {
    productId: string;
    userId: string;
    quantity: number;
    reservationId: string;
    expiresAtMs: number;
  }): Promise<number> {
    return this.redis.reserveStock(
      this.stockKey(p.productId),
      this.resKey(p.reservationId),
      PENDING_ZSET,
      p.quantity,
      p.productId,
      p.userId,
      p.expiresAtMs,
      p.reservationId,
    );
  }

  async consume(
    reservationId: string,
    userId: string,
  ): Promise<number | [number, string]> {
    return this.redis.consumeReservation(
      this.resKey(reservationId),
      PENDING_ZSET,
      reservationId,
      userId,
      Date.now(),
    );
  }

  async release(reservationId: string, productId: string): Promise<number> {
    return this.redis.releaseReservation(
      this.stockKey(productId),
      this.resKey(reservationId),
      PENDING_ZSET,
      reservationId,
    );
  }

  /** Reaper support: fetch reservation ids that expired at/before `nowMs`. */
  async expiredReservations(nowMs: number, limit = 500): Promise<string[]> {
    return this.redis.zrangebyscore(PENDING_ZSET, 0, nowMs, 'LIMIT', 0, limit);
  }

  async productIdOf(reservationId: string): Promise<string | null> {
    return this.redis.hget(this.resKey(reservationId), 'productId');
  }
}
