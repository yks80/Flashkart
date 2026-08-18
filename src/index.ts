import 'reflect-metadata';
import { env } from './config/env';
import { AppDataSource } from './config/dataSource';
import { redisClient } from './config/redis';
import { RedisService } from './redis/redisService';
import { StubPaymentGateway } from './modules/payment/paymentGateway';
import { ReservationReaper } from './reaper/reservationReaper';
import { createApp } from './app';

async function bootstrap() {
  // 1. Connect infrastructure.
  await AppDataSource.initialize();
  console.log('[db] connected');

  const redisService = new RedisService(redisClient);
  const payment = new StubPaymentGateway();

  // 2. Build the HTTP app.
  const app = createApp(AppDataSource, redisService, payment);

  // 3. Start the background reaper (leader-elected via Redis lock).
  const reaper = new ReservationReaper(redisClient, redisService, env.reaperIntervalMs);
  reaper.start();

  // 4. Listen.
  const server = app.listen(env.port, () => {
    console.log(`[http] FlashKart listening on :${env.port}`);
  });

  // 5. Graceful shutdown.
  const shutdown = async (signal: string) => {
    console.log(`[shutdown] ${signal}`);
    reaper.stop();
    server.close();
    await AppDataSource.destroy();
    await redisClient.quit();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[bootstrap] failed', err);
  process.exit(1);
});
