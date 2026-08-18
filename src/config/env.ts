import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  port: parseInt(required('PORT', '3000'), 10),
  nodeEnv: required('NODE_ENV', 'development'),

  db: {
    host: required('DB_HOST', 'localhost'),
    port: parseInt(required('DB_PORT', '5432'), 10),
    user: required('DB_USER', 'flashkart'),
    password: required('DB_PASSWORD', 'flashkart'),
    name: required('DB_NAME', 'flashkart'),
    synchronize: required('DB_SYNCHRONIZE', 'false') === 'true',
  },

  redis: {
    host: required('REDIS_HOST', 'localhost'),
    port: parseInt(required('REDIS_PORT', '6379'), 10),
  },

  reservationTtlMs: parseInt(required('RESERVATION_TTL_MS', '300000'), 10),
  reaperIntervalMs: parseInt(required('REAPER_INTERVAL_MS', '2000'), 10),
};
