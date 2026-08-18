import express, { Application } from 'express';
import { DataSource } from 'typeorm';
import { RedisService } from './redis/redisService';
import { PaymentGateway } from './modules/payment/paymentGateway';
import { buildReservationRouter } from './modules/reservation/reservationRoutes';
import { buildCheckoutRouter } from './modules/checkout/checkoutRoutes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(
  ds: DataSource,
  redis: RedisService,
  payment: PaymentGateway,
): Application {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/cart', buildReservationRouter(redis));
  app.use('/order', buildCheckoutRouter(ds, redis, payment));

  // Must be last: central error → HTTP mapping.
  app.use(errorHandler);

  return app;
}
