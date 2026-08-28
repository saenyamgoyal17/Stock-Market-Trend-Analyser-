import { createWorker } from '../lib/queue.js';
import { QUEUE_NAMES } from './queues.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { DateTime } from 'luxon';

createWorker(QUEUE_NAMES.CALCULATE_SECTOR_IMPACTS, async (job) => {
  try {
    const thirtyDaysAgo = DateTime.now().minus({ days: 30 }).toJSDate();
    
    // SectorImpact doesn't have a relation to WorldEvent in the schema,
    // so we need to join manually via eventId
    const impacts = await prisma.sectorImpact.findMany({
      where: {
        calculatedAt: { gte: thirtyDaysAgo }
      }
    });

    // Fetch associated events for categorization
    const eventIds = [...new Set(impacts.map(i => i.eventId))];
    const events = await prisma.worldEvent.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, category: true }
    });
    const eventCategoryMap = new Map(events.map(e => [e.id, e.category]));

    const matrix: Record<string, Record<string, { total: number; count: number }>> = {};

    for (const impact of impacts) {
      if (!matrix[impact.sector]) matrix[impact.sector] = {};
      const cat = eventCategoryMap.get(impact.eventId) || 'UNKNOWN';
      
      if (!matrix[impact.sector][cat]) {
        matrix[impact.sector][cat] = { total: 0, count: 0 };
      }
      
      matrix[impact.sector][cat].total += Number(impact.changeAvg || 0);
      matrix[impact.sector][cat].count++;
    }

    const finalMatrix: Record<string, Record<string, number>> = {};
    for (const sector in matrix) {
      finalMatrix[sector] = {};
      for (const cat in matrix[sector]) {
        const data = matrix[sector][cat];
        finalMatrix[sector][cat] = data.total / data.count;
      }
    }

    await redis.set('sector:impact:matrix', JSON.stringify(finalMatrix), 'EX', 3600);
    logger.info('Sector impact matrix recalculated');
  } catch (error) {
    logger.error({ err: error }, 'Error in calculate-sector-impacts job');
  }
});
