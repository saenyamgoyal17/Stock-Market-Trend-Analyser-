import { createWorker } from '../lib/queue.js';
import { QUEUE_NAMES } from './queues.js';
import { logger } from '../lib/logger.js';
import { fxService } from '../services/fx.service.js';

createWorker(QUEUE_NAMES.FETCH_FX_RATES, async (job) => {
  try {
    await fxService.refreshAllRates();
    logger.info('FX rates refreshed');
  } catch (error) {
    logger.error({ err: error }, 'Error in fetch-fx-rates job');
  }
});
