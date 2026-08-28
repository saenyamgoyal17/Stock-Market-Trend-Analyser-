import { createWorker } from '../lib/queue.js';
import { QUEUE_NAMES } from './queues.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { isExchangeOpen } from '../utils/exchange-hours.js';
import { EXCHANGES } from '../config/exchanges.js';
import { broadcastMarketStatus } from '../ws/broadcaster.js';

createWorker(QUEUE_NAMES.UPDATE_MARKET_STATUS, async (job) => {
  try {
    let changedCount = 0;
    
    for (const [code, exchange] of EXCHANGES) {
      const isOpen = isExchangeOpen(exchange.code);
      const cacheKey = `market:status:${exchange.code}`;
      const cached = await redis.get(cacheKey);
      
      const cachedStatus = cached === 'true';
      
      if (cached === null || cachedStatus !== isOpen) {
        await redis.set(cacheKey, isOpen ? 'true' : 'false');
        broadcastMarketStatus(exchange.code, isOpen);
        changedCount++;
      }
    }
    
    if (changedCount > 0) {
      logger.info(`${changedCount} exchange statuses updated`);
    }
  } catch (error) {
    logger.error({ err: error }, 'Error in update-market-status job');
  }
});
