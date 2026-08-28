import { createWorker } from '../lib/queue.js';
import { QUEUE_NAMES } from './queues.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { DateTime } from 'luxon';

createWorker(QUEUE_NAMES.CLEANUP_OLD_DATA, async (job) => {
  try {
    const fiveYearsAgo = DateTime.now().minus({ years: 5 }).toJSDate();

    const priceResult = await prisma.priceHistory.deleteMany({
      where: { timestamp: { lt: fiveYearsAgo } }
    });

    // SearchHistory doesn't have createdAt in our schema — skip or clean by ID range
    // For now, just clean price history
    logger.info(`Cleanup complete: ${priceResult.count} price records deleted`);
  } catch (error) {
    logger.error({ err: error }, 'Error in cleanup-old-data job');
  }
});
