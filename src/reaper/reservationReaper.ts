import Redis from 'ioredis';
import { RedisService } from '../redis/redisService';

const REAPER_LOCK_KEY = 'reaper:lock';

/**
 * Reclaims stock from reservations that expired without checkout.
 *
 * Redis key expiry alone does NOT return stock -- this loop reads the pending
 * ZSET and calls release.lua, which atomically no-ops if the reservation was
 * already consumed. A short Redis lock ensures only one instance reaps at a
 * time (leader election) when the API runs as multiple replicas.
 */
export class ReservationReaper {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly raw: Redis,
    private readonly redis: RedisService,
    private readonly intervalMs: number,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick().catch((e) => console.error('[reaper]', e)), this.intervalMs);
    console.log(`[reaper] started (every ${this.intervalMs}ms)`);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    // Acquire a short lease so only one replica reaps per interval.
    const gotLock = await this.raw.set(REAPER_LOCK_KEY, '1', 'PX', this.intervalMs, 'NX');
    if (!gotLock) return;

    const now = Date.now();
    const expired = await this.redis.expiredReservations(now, 500);

    for (const reservationId of expired) {
      const productId = await this.redis.productIdOf(reservationId);
      if (!productId) continue;
      const returned = await this.redis.release(reservationId, productId);
      if (returned > 0) {
        console.log(`[reaper] released ${returned} unit(s) from ${reservationId}`);
      }
    }
  }
}
