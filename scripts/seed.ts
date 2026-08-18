import 'reflect-metadata';
import { AppDataSource } from '../src/config/dataSource';
import { redisClient } from '../src/config/redis';
import { RedisService } from '../src/redis/redisService';
import { User } from '../src/entities/User';
import { Product } from '../src/entities/Product';

/**
 * Seeds a demo user and one live flash-sale product (stock = 100), then warms
 * the Redis counter so /cart/reserve works immediately.
 *
 * Prints the userId and productId you need for requests / the load test.
 */
async function main() {
  await AppDataSource.initialize();
  const redis = new RedisService(redisClient);

  const userRepo = AppDataSource.getRepository(User);
  const productRepo = AppDataSource.getRepository(Product);

  const user = await userRepo.save(
    userRepo.create({ email: `demo+${Date.now()}@flashkart.dev`, name: 'Demo User' }),
  );

  const now = new Date();
  const product = await productRepo.save(
    productRepo.create({
      name: 'FlashKart Lightning Deal',
      stock: 100,
      price: '499.00',
      isActive: true,
      saleStartAt: now,
      saleEndAt: new Date(now.getTime() + 60 * 60 * 1000),
    }),
  );

  // Warm the live counter (NX-safe).
  await redis.warmStock(product.id, product.stock);

  console.log('Seed complete:');
  console.log('  USER_ID    =', user.id);
  console.log('  PRODUCT_ID =', product.id);
  console.log('  stock:' + product.id, '=', await redis.getStock(product.id));

  await AppDataSource.destroy();
  await redisClient.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
