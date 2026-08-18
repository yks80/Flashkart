import { Router } from 'express';
import { DataSource } from 'typeorm';
import { authMiddleware } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { RedisService } from '../../redis/redisService';
import { CheckoutService } from './checkoutService';
import { checkoutHandler, checkoutSchema } from './checkoutController';
import { PaymentGateway } from '../payment/paymentGateway';

export function buildCheckoutRouter(
  ds: DataSource,
  redis: RedisService,
  payment: PaymentGateway,
): Router {
  const router = Router();
  const service = new CheckoutService(ds, redis, payment);

  // POST /order/checkout
  router.post(
    '/checkout',
    authMiddleware,
    validateBody(checkoutSchema),
    checkoutHandler(service),
  );

  return router;
}
