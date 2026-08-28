import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { polygonClient } from '../clients/polygon.client.js';
import { finnhubClient } from '../clients/finnhub.client.js';
import { fmpClient } from '../clients/fmp.client.js';
import { fxService } from './fx.service.js';

class StockService {
  async search(query: string, exchange?: string, country?: string, limit: number = 20, userCurrency: string = 'USD') {
    try {
      const cacheKey = `search:${query}:${exchange || 'all'}:${country || 'all'}:${limit}`;
      const cached = await redis.get(cacheKey);
      
      let stocks: any[] = [];
      if (cached) {
        stocks = JSON.parse(cached);
      } else {
        const queryTerm = query.trim().replace(/\s+/g, ' | ');
        const sqlQuery = `
          SELECT * FROM "Stock" 
          WHERE to_tsvector('english', name || ' ' || symbol || ' ' || exchange || ' ' || COALESCE(sector, '')) @@ to_tsquery('english', $1)
          ${exchange ? `AND exchange = $2` : ''}
          ${country ? `AND country = ${exchange ? '$3' : '$2'}` : ''}
          LIMIT ${exchange && country ? '$4' : exchange || country ? '$3' : '$2'}
        `;
        
        const params: any[] = [queryTerm];
        if (exchange) params.push(exchange);
        if (country) params.push(country);
        params.push(limit);

        stocks = await prisma.$queryRawUnsafe(sqlQuery, ...params);
        await redis.setex(cacheKey, 1800, JSON.stringify(stocks));
      }

      if (userCurrency !== 'USD') {
        for (const stock of stocks) {
          if (stock.currency !== userCurrency) {
            const conversion = await fxService.convert(stock.lastPrice, stock.currency, userCurrency);
            if (conversion.success && conversion.data) {
                stock.lastPrice = conversion.data.result;
            }
          }
        }
      }

      return { success: true, data: stocks };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in search');
      return { success: false, error: { code: 'SEARCH_ERROR', message: error.message } };
    }
  }

  async getBySymbol(symbol: string) {
    try {
      const cacheKey = `stock:${symbol}:details`;
      const cached = await redis.get(cacheKey);
      if (cached) return { success: true, data: JSON.parse(cached) };

      const stock = await prisma.stock.findUnique({
        where: { symbol },
        include: {
          priceHistory: {
            orderBy: { timestamp: 'desc' },
            take: 252 // approx 52 weeks of trading days
          }
        }
      });

      if (!stock) throw new Error('Stock not found');
      
      await redis.setex(cacheKey, 3600, JSON.stringify(stock));
      return { success: true, data: stock };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getBySymbol');
      return { success: false, error: { code: 'NOT_FOUND', message: error.message } };
    }
  }

  async getFundamentals(symbol: string) {
    try {
      const cacheKey = `fundamentals:${symbol}`;
      const cached = await redis.get(cacheKey);
      if (cached) return { success: true, data: JSON.parse(cached) };

      let fundamentals = await fmpClient.getKeyMetrics(symbol).catch(() => null);
      if (!fundamentals) {
        fundamentals = await finnhubClient.getBasicFinancials(symbol).catch(() => null);
      }

      if (!fundamentals) throw new Error('Failed to fetch fundamentals');
      
      await redis.setex(cacheKey, 3600, JSON.stringify(fundamentals));
      return { success: true, data: fundamentals };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getFundamentals');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async getSimilar(symbol: string, limit: number = 5) {
    try {
      const stock = await prisma.stock.findUnique({ where: { symbol } });
      if (!stock || !stock.sector) return { success: true, data: [] };

      const similar = await prisma.stock.findMany({
        where: {
          sector: stock.sector,
          industry: stock.industry,
          symbol: { not: symbol }
        },
        take: limit
      });

      return { success: true, data: similar };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getSimilar');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async getMovers(type: 'gainers' | 'losers' | 'volatile', market?: string, limit: number = 10) {
    try {
      const orderBy = type === 'gainers' 
        ? { lastChangePct: 'desc' }
        : type === 'losers'
        ? { lastChangePct: 'asc' }
        : undefined;

      let data;
      if (type === 'volatile') {
          // Simplification for volatile as abs desc is not directly supported in Prisma orderBy
          const rawMovers = await prisma.$queryRawUnsafe(`
            SELECT * FROM "Stock"
            ${market ? `WHERE exchange = '${market}'` : ''}
            ORDER BY ABS("lastChangePct") DESC
            LIMIT ${limit}
          `);
          data = rawMovers;
      } else {
        data = await prisma.stock.findMany({
            where: market ? { exchange: market } : undefined,
            orderBy: orderBy as any,
            take: limit
        });
      }

      return { success: true, data };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getMovers');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async getMarketSummary() {
    try {
      const cached = await redis.get('market_summary');
      if (cached) return { success: true, data: JSON.parse(cached) };
      return { success: true, data: [] };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getMarketSummary');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async getStockEvents(symbol: string, limit: number, offset: number) {
    try {
      const stock = await prisma.stock.findUnique({ where: { symbol } });
      if (!stock) throw new Error('Stock not found');

      const events = await prisma.stockEvent.findMany({
        where: { stockId: stock.id },
        include: { event: true },
        take: limit,
        skip: offset,
        orderBy: { event: { publishedAt: 'desc' } }
      });

      return { success: true, data: events };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getStockEvents');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async syncStockFromApi(symbol: string) {
    try {
      const details = await polygonClient.getTickerDetails(symbol);
      if (!details) throw new Error('Could not fetch details from API');

      const stock = await prisma.stock.upsert({
        where: { symbol },
        update: {
          name: details.name,
          exchange: details.primary_exchange,
          country: details.locale,
          currency: details.currency_name,
          marketCap: details.market_cap,
          isActive: details.active
        },
        create: {
          symbol,
          name: details.name,
          exchange: details.primary_exchange,
          country: details.locale,
          currency: details.currency_name,
          marketCap: details.market_cap,
          isActive: details.active
        }
      });

      return { success: true, data: stock };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in syncStockFromApi');
      return { success: false, error: { code: 'SYNC_FAILED', message: error.message } };
    }
  }
}

export const stockService = new StockService();
