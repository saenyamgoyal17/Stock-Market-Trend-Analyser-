import { Queue, Worker, Processor, WorkerOptions } from 'bullmq';
import { redis } from './redis.js';

export const FETCH_PRICES = 'FETCH_PRICES';
export const FETCH_EVENTS = 'FETCH_EVENTS';
export const ANALYZE_EVENT = 'ANALYZE_EVENT';
export const FETCH_FX_RATES = 'FETCH_FX_RATES';
export const UPDATE_MARKET_STATUS = 'UPDATE_MARKET_STATUS';
export const CALCULATE_SECTOR_IMPACTS = 'CALCULATE_SECTOR_IMPACTS';
export const SYNC_STOCK_CATALOG = 'SYNC_STOCK_CATALOG';
export const COMPUTE_PORTFOLIO_PNL = 'COMPUTE_PORTFOLIO_PNL';
export const CLEANUP_OLD_DATA = 'CLEANUP_OLD_DATA';

export function createQueue(name: string): Queue {
  return new Queue(name, { connection: redis as any });
}

export function createWorker(name: string, processor: Processor, opts?: Omit<WorkerOptions, 'connection'>): Worker {
  return new Worker(name, processor, { connection: redis as any, ...opts });
}
