import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { polygonClient } from '../clients/polygon.client.js';
import { finnhubClient } from '../clients/finnhub.client.js';
import { fxService } from './fx.service.js';

class PriceService {
  async getCurrentPrice(symbol: string, currency?: string) {
    try {
      const cacheKey = `price:${symbol}`;
      const cached = await redis.get(cacheKey);
      
      let priceData;
      if (cached) {
        priceData = JSON.parse(cached);
      } else {
        priceData = await polygonClient.getLatestPrice(symbol).catch(() => null);
        if (!priceData) {
          priceData = await finnhubClient.getQuote(symbol).catch(() => null);
        }

        if (!priceData) throw new Error('Unable to fetch price data');
        
        await redis.setex(cacheKey, 30, JSON.stringify(priceData));
      }

      if (currency && currency !== priceData.currency) {
        const conversion = await fxService.convert(priceData.price, priceData.currency || 'USD', currency);
        if (conversion.success && conversion.data) {
          priceData.price = conversion.data.result;
          priceData.currency = currency;
        }
      }

      return { success: true, data: priceData };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getCurrentPrice');
      return { success: false, error: { code: 'PRICE_FETCH_FAILED', message: error.message } };
    }
  }

  async getHistory(symbol: string, period: string, interval: string) {
    try {
      // Basic fallback to dummy dates. In a real app, calculate actual from/to based on period
      const to = new Date();
      const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days default
      
      let history = await polygonClient.getAggregates(symbol, 1, 'day', from.toISOString().split('T')[0], to.toISOString().split('T')[0]).catch(() => null);
      if (!history) {
        history = await finnhubClient.getCandles(symbol, 'D', Math.floor(from.getTime() / 1000), Math.floor(to.getTime() / 1000)).catch(() => null);
      }

      if (!history) throw new Error('Failed to fetch price history');

      return { success: true, data: history };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getHistory');
      return { success: false, error: { code: 'HISTORY_FETCH_FAILED', message: error.message } };
    }
  }

  async updateStockPrice(symbol: string, price: number, change: number, changePct: number) {
    try {
      const stock = await prisma.stock.update({
        where: { symbol },
        data: {
          lastPrice: price,
          lastChange: change,
          lastChangePct: changePct,
          lastUpdated: new Date()
        }
      });

      const cacheKey = `stock:${symbol}:details`;
      await redis.del(cacheKey);

      return { success: true, data: stock };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in updateStockPrice');
      return { success: false, error: { code: 'UPDATE_FAILED', message: error.message } };
    }
  }

  async storePriceHistory(symbol: string, data: any[]) {
    try {
      const stock = await prisma.stock.findUnique({ where: { symbol } });
      if (!stock) throw new Error('Stock not found');

      const records = data.map(d => ({
        stockId: stock.id,
        timestamp: new Date(d.timestamp),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
        vwap: d.vwap
      }));

      await prisma.priceHistory.createMany({
        data: records,
        skipDuplicates: true
      });

      return { success: true, data: { count: records.length } };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in storePriceHistory');
      return { success: false, error: { code: 'STORE_FAILED', message: error.message } };
    }
  }
}

export const priceService = new PriceService();
