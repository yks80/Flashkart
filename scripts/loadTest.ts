import 'reflect-metadata';
import { redisClient } from '../src/config/redis';
import { RedisService } from '../src/redis/redisService';
import { randomUUID } from 'crypto';

/**
 * Concurrency proof: fire N reservations at a counter warmed to STOCK and show
 * that exactly STOCK succeed -- never one more. Run against a fresh key.
 *
 *   STOCK=100 N=200 ts-node scripts/loadTest.ts
 */
async function main() {
  const redis = new RedisService(redisClient);

  const STOCK = parseInt(process.env.STOCK ?? '100', 10);
  const N = parseInt(process.env.N ?? '200', 10);
  const productId = `loadtest-${randomUUID()}`;

  // Force-set (not NX) so re-runs start clean.
  await redisClient.set(`stock:${productId}`, STOCK);

  const attempts = Array.from({ length: N }, (_, i) =>
    redis
      .reserve({
        productId,
        userId: `user-${i}`,
        quantity: 1,
        reservationId: randomUUID(),
        expiresAtMs: Date.now() + 60_000,
      })
      .then((code) => code === 1),
  );

  const results = await Promise.all(attempts);
  const success = results.filter(Boolean).length;
  const failed = N - success;
  const remaining = await redis.getStock(productId);

  console.log('---- FlashKart concurrency test ----');
  console.log('warmed stock      :', STOCK);
  console.log('concurrent tries  :', N);
  console.log('successful reserve:', success);
  console.log('rejected          :', failed);
  console.log('remaining in redis:', remaining);
  console.log('oversold?         :', success > STOCK ? 'YES ❌' : 'NO ✅');

  await redisClient.del(`stock:${productId}`);
  await redisClient.quit();
  process.exit(success === STOCK && remaining === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
