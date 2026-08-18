import { randomUUID } from 'crypto';
import { RedisService } from '../../redis/redisService';
import { AppError } from '../../common/errors';
import { env } from '../../config/env';

export interface ReservationResult {
  reservationId: string;
  expiresAt: Date;
  quantity: number;
}

export class ReservationService {
  constructor(private readonly redis: RedisService) {}

  async reserve(userId: string, productId: string, quantity: number): Promise<ReservationResult> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError(400, 'INVALID_QUANTITY', 'Quantity must be a positive integer.');
    }

    const reservationId = randomUUID();
    const expiresAtMs = Date.now() + env.reservationTtlMs;

    const code = await this.redis.reserve({
      productId,
      userId,
      quantity,
      reservationId,
      expiresAtMs,
    });

    switch (code) {
      case 1:
        return { reservationId, expiresAt: new Date(expiresAtMs), quantity };
      case 0:
        throw new AppError(409, 'INSUFFICIENT_STOCK', 'Not enough stock available.');
      case -1:
        throw new AppError(409, 'SALE_NOT_ACTIVE', 'This flash sale is not active.');
      default:
        throw new AppError(500, 'RESERVE_FAILED', 'Could not reserve stock.');
    }
  }
}
