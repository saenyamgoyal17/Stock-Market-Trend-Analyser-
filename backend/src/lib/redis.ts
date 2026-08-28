import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from './logger.js';

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis error');
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

export function getRedisConnection() {
  return {
    url: config.redis.url,
    maxRetriesPerRequest: null,
  };
}
