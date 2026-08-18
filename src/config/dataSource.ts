import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './env';
import { User } from '../entities/User';
import { Product } from '../entities/Product';
import { Cart } from '../entities/Cart';
import { CartItem } from '../entities/CartItem';
import { Order } from '../entities/Order';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.db.host,
  port: env.db.port,
  username: env.db.user,
  password: env.db.password,
  database: env.db.name,
  entities: [User, Product, Cart, CartItem, Order],
  migrations: ['src/migrations/*.ts'],
  // synchronize is convenient in dev; use migrations in production.
  synchronize: env.db.synchronize,
  logging: env.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
  // Pool sizing: keep small per-process; PgBouncer fans out in front of PG.
  extra: { max: 20 },
});
