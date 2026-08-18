import Redis from 'ioredis';
import { env } from './env';

export const redisClient = new Redis({
  host: env.redis.host,
  port: env.redis.port,
  // Fail fast under load rather than queueing forever.
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redisClient.on('error', (err) => console.error('[redis] error', err.message));
redisClient.on('connect', () => console.log('[redis] connected'));
