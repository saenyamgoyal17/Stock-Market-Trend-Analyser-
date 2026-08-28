import { createQueue } from '../lib/queue.js';
import { logger } from '../lib/logger.js';

export const QUEUE_NAMES = {
  FETCH_PRICES: 'fetch-prices',
  FETCH_EVENTS: 'fetch-events',
  FETCH_FX_RATES: 'fetch-fx-rates',
  UPDATE_MARKET_STATUS: 'update-market-status',
  CALCULATE_SECTOR_IMPACTS: 'calculate-sector-impacts',
  SYNC_STOCK_CATALOG: 'sync-stock-catalog',
  COMPUTE_PORTFOLIO_PNL: 'compute-portfolio-pnl',
  CLEANUP_OLD_DATA: 'cleanup-old-data',
  ANALYZE_EVENT: 'analyze-event'
};

export async function initializeQueues() {
  const fetchPricesQueue = createQueue(QUEUE_NAMES.FETCH_PRICES);
  const fetchEventsQueue = createQueue(QUEUE_NAMES.FETCH_EVENTS);
  const fetchFxRatesQueue = createQueue(QUEUE_NAMES.FETCH_FX_RATES);
  const updateMarketStatusQueue = createQueue(QUEUE_NAMES.UPDATE_MARKET_STATUS);
  const calculateSectorImpactsQueue = createQueue(QUEUE_NAMES.CALCULATE_SECTOR_IMPACTS);
  const syncStockCatalogQueue = createQueue(QUEUE_NAMES.SYNC_STOCK_CATALOG);
  const computePortfolioPnlQueue = createQueue(QUEUE_NAMES.COMPUTE_PORTFOLIO_PNL);
  const cleanupOldDataQueue = createQueue(QUEUE_NAMES.CLEANUP_OLD_DATA);
  const analyzeEventQueue = createQueue(QUEUE_NAMES.ANALYZE_EVENT);

  await fetchPricesQueue.add('fetch-prices', {}, { repeat: { every: 15000 } });
  await fetchEventsQueue.add('fetch-events', {}, { repeat: { every: 300000 } });
  await fetchFxRatesQueue.add('fetch-fx-rates', {}, { repeat: { every: 600000 } });
  await updateMarketStatusQueue.add('update-market-status', {}, { repeat: { every: 60000 } });
  await calculateSectorImpactsQueue.add('calculate-sector-impacts', {}, { repeat: { every: 3600000 } });
  await syncStockCatalogQueue.add('sync-stock-catalog', {}, { repeat: { pattern: '0 2 * * *' } });
  await computePortfolioPnlQueue.add('compute-portfolio-pnl', {}, { repeat: { every: 1800000 } });
  await cleanupOldDataQueue.add('cleanup-old-data', {}, { repeat: { pattern: '0 3 * * *' } });

  // Load workers
  await import('./fetch-prices.job.js');
  await import('./fetch-events.job.js');
  await import('./analyze-event.job.js');
  await import('./fetch-fx-rates.job.js');
  await import('./update-market-status.job.js');
  await import('./calculate-sector-impacts.job.js');
  await import('./sync-stock-catalog.job.js');
  await import('./compute-portfolio-pnl.job.js');
  await import('./cleanup-old-data.job.js');

  logger.info('Queues initialized successfully');
}
