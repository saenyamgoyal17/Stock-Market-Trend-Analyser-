import { createWorker } from '../lib/queue.js';
import { QUEUE_NAMES } from './queues.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { broadcastPriceUpdate } from '../ws/broadcaster.js';
import { isExchangeOpen } from '../utils/exchange-hours.js';
import { polygonClient } from '../clients/polygon.client.js';
import { finnhubClient } from '../clients/finnhub.client.js';
import { EXCHANGES } from '../config/exchanges.js';

createWorker(QUEUE_NAMES.FETCH_PRICES, async (job) => {
  try {
    let symbols: string[] = await redis.smembers('tracked:symbols');
    if (!symbols || symbols.length === 0) {
      const stocks = await prisma.stock.findMany({ where: { isActive: true }, select: { symbol: true }, take: 500 });
      symbols = stocks.map(s => s.symbol);
    }

    const anyOpen = Array.from(EXCHANGES.values()).some(exchange => isExchangeOpen(exchange.code));
    if (!anyOpen) {
      logger.info('All major exchanges closed. Skipping price fetch.');
      return;
    }

    const batchSize = 50;
    let updatedCount = 0;

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      try {
        const snapshots: any[] = await polygonClient.getSnapshotAllTickers() as any[];
        for (const snap of snapshots) {
          await processPriceUpdate(snap.ticker, snap.day.c, snap.todaysChange, snap.todaysChangePerc);
          updatedCount++;
        }
      } catch (err) {
        for (const symbol of batch) {
          try {
            const quote = await finnhubClient.getQuote(symbol);
            if (quote) {
              const change = quote.c - quote.pc;
              const changePct = (change / quote.pc) * 100;
              await processPriceUpdate(symbol, quote.c, change, changePct);
              updatedCount++;
            }
          } catch (e) {
            // Ignore
          }
        }
      }
    }

    logger.info(`${updatedCount} symbols updated`);
  } catch (error) {
    logger.error({ err: error }, 'Error in fetch-prices job');
  }
});

async function processPriceUpdate(symbol: string, price: number, change: number, changePct: number) {
  await redis.set(`price:${symbol}`, JSON.stringify({ price, change, changePct, updated: Date.now() }));
  
  await prisma.stock.update({
    where: { symbol },
    data: {
      lastPrice: price,
      lastChange: change,
      lastChangePct: changePct,
      lastUpdated: new Date()
    }
  });

  const stock = await prisma.stock.findUnique({ where: { symbol }, select: { currency: true }});
  
  broadcastPriceUpdate(symbol, price, change, changePct, stock?.currency || 'USD');
}
