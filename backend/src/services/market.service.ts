import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';
import { polygonClient } from '../clients/polygon.client.js';

class MarketService {
  async getMarkets() {
    try {
      // Mocked exchanges
      const EXCHANGES = [
        { code: 'NYSE', name: 'New York Stock Exchange', country: 'US' },
        { code: 'NASDAQ', name: 'NASDAQ', country: 'US' }
      ];
      
      const markets = EXCHANGES.map(ex => ({
        ...ex,
        isOpen: this.isExchangeOpen(ex.code)
      }));
      
      return { success: true, data: markets };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getMarkets');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  isExchangeOpen(exchangeCode: string): boolean {
    // simplified check
    const hour = new Date().getUTCHours();
    return hour >= 13 && hour <= 20; // rough US market hours in UTC
  }

  async getExchangeStatus(exchangeCode: string) {
    try {
      const isOpen = this.isExchangeOpen(exchangeCode);
      return { success: true, data: { isOpen, nextOpen: new Date(), nextClose: new Date(), timezone: 'UTC' } };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getExchangeStatus');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async getGlobalSnapshot() {
    try {
      const cached = await redis.get('global_indices');
      if (cached) return { success: true, data: JSON.parse(cached) };

      // fallback 
      const indices = [
        { symbol: 'SPY', name: 'S&P 500' },
        { symbol: 'QQQ', name: 'NASDAQ 100' }
      ];

      await redis.setex('global_indices', 60, JSON.stringify(indices));
      return { success: true, data: indices };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getGlobalSnapshot');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async updateMarketStatuses() {
    try {
      // Broadcast logic would go here
      return { success: true, data: null };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in updateMarketStatuses');
      return { success: false, error: { code: 'UPDATE_FAILED', message: error.message } };
    }
  }
}

export const marketService = new MarketService();
