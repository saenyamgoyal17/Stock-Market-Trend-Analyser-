import { createWorker } from '../lib/queue.js';
import { QUEUE_NAMES } from './queues.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { polygonClient } from '../clients/polygon.client.js';

createWorker(QUEUE_NAMES.SYNC_STOCK_CATALOG, async (job) => {
  try {
    let cursor: string | undefined = undefined;
    let added = 0;
    let updated = 0;
    
    const res: any = await polygonClient.getAllTickers(cursor);
    const tickers = res.results || [];
    
    for (const t of tickers) {
      const exists = await prisma.stock.findUnique({ where: { symbol: t.ticker } });
      if (exists) {
        await prisma.stock.update({
          where: { symbol: t.ticker },
          data: { name: t.name, isActive: t.active }
        });
        updated++;
      } else {
        await prisma.stock.create({
          data: {
            symbol: t.ticker,
            name: t.name,
            exchange: t.primary_exchange || 'UNKNOWN',
            country: 'US',
            currency: 'USD',
            isActive: t.active
          }
        });
        added++;
      }
    }
    
    const allActive = await prisma.stock.findMany({ where: { isActive: true }, select: { symbol: true } });
    const symbols = allActive.map(s => s.symbol);
    
    await redis.del('tracked:symbols');
    if (symbols.length > 0) {
        await redis.sadd('tracked:symbols', ...symbols);
    }
    
    logger.info(`Stock catalog synced. Added: ${added}, Updated: ${updated}`);
  } catch (error) {
    logger.error({ err: error }, 'Error in sync-stock-catalog job');
  }
});
