import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { RedisService } from '../../redis/redisService';
import { ReservationService } from './reservationService';
import { reserveHandler, reserveSchema } from './reservationController';

export function buildReservationRouter(redis: RedisService): Router {
  const router = Router();
  const service = new ReservationService(redis);

  // POST /cart/reserve
  router.post(
    '/reserve',
    authMiddleware,
    validateBody(reserveSchema),
    reserveHandler(service),
  );

  return router;
}
