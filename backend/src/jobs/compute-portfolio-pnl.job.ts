import { createWorker } from '../lib/queue.js';
import { QUEUE_NAMES } from './queues.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { priceService } from '../services/price.service.js';

createWorker(QUEUE_NAMES.COMPUTE_PORTFOLIO_PNL, async (job) => {
  try {
    const portfolios = await prisma.portfolio.findMany();
    
    let computed = 0;
    for (const p of portfolios) {
      try {
        const holdings = (p.holdings as any[]) || [];
        let totalValue = 0;
        let totalCost = 0;
        
        for (const h of holdings) {
          const currentPrice = await priceService.getCurrentPrice(h.symbol);
          if (currentPrice) {
            totalValue += Number(currentPrice) * Number(h.shares);
            totalCost += Number(h.avgPrice) * Number(h.shares);
          }
        }
        
        const pnl = totalValue - totalCost;
        const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
        
        await redis.set(`portfolio:pnl:${p.id}`, JSON.stringify({
          value: totalValue,
          cost: totalCost,
          pnl,
          pnlPct,
          updatedAt: Date.now()
        }));
        
        computed++;
      } catch (e) {
        logger.warn({ err: e, portfolioId: p.id }, 'Failed to compute PNL for portfolio');
      }
    }
    
    logger.info(`P&L computed for ${computed} portfolios`);
  } catch (error) {
    logger.error({ err: error }, 'Error in compute-portfolio-pnl job');
  }
});
