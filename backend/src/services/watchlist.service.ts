import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { priceService } from './price.service.js';

class WatchlistService {
  async getUserWatchlists(userId: string) {
    try {
      const watchlists = await prisma.watchlist.findMany({ where: { userId } });
      return { success: true, data: watchlists };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getUserWatchlists');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async create(userId: string, name: string, symbols: string[]) {
    try {
      const watchlist = await prisma.watchlist.create({
        data: { userId, name, symbols }
      });
      return { success: true, data: watchlist };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in create watchlist');
      return { success: false, error: { code: 'CREATE_FAILED', message: error.message } };
    }
  }

  async update(userId: string, watchlistId: string, data: { name?: string; symbols?: string[] }) {
    try {
      const existing = await prisma.watchlist.findUnique({ where: { id: watchlistId } });
      if (!existing || existing.userId !== userId) throw new Error('Not found or unauthorized');

      const watchlist = await prisma.watchlist.update({
        where: { id: watchlistId },
        data
      });
      return { success: true, data: watchlist };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in update watchlist');
      return { success: false, error: { code: 'UPDATE_FAILED', message: error.message } };
    }
  }

  async delete(userId: string, watchlistId: string) {
    try {
      const existing = await prisma.watchlist.findUnique({ where: { id: watchlistId } });
      if (!existing || existing.userId !== userId) throw new Error('Not found or unauthorized');

      await prisma.watchlist.delete({ where: { id: watchlistId } });
      return { success: true, data: null };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in delete watchlist');
      return { success: false, error: { code: 'DELETE_FAILED', message: error.message } };
    }
  }

  async addSymbol(userId: string, watchlistId: string, symbol: string) {
    try {
      const watchlist = await prisma.watchlist.findUnique({ where: { id: watchlistId } });
      if (!watchlist || watchlist.userId !== userId) throw new Error('Not found or unauthorized');

      if (!watchlist.symbols.includes(symbol)) {
        const updated = await prisma.watchlist.update({
          where: { id: watchlistId },
          data: { symbols: { push: symbol } }
        });
        return { success: true, data: updated };
      }
      return { success: true, data: watchlist };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in addSymbol');
      return { success: false, error: { code: 'UPDATE_FAILED', message: error.message } };
    }
  }

  async removeSymbol(userId: string, watchlistId: string, symbol: string) {
    try {
      const watchlist = await prisma.watchlist.findUnique({ where: { id: watchlistId } });
      if (!watchlist || watchlist.userId !== userId) throw new Error('Not found or unauthorized');

      const updated = await prisma.watchlist.update({
        where: { id: watchlistId },
        data: { symbols: watchlist.symbols.filter(s => s !== symbol) }
      });
      return { success: true, data: updated };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in removeSymbol');
      return { success: false, error: { code: 'UPDATE_FAILED', message: error.message } };
    }
  }

  async getWatchlistData(userId: string, watchlistId: string, userCurrency: string) {
    try {
      const watchlist = await prisma.watchlist.findUnique({ where: { id: watchlistId } });
      if (!watchlist || watchlist.userId !== userId) throw new Error('Not found or unauthorized');

      const data = await Promise.all(
        watchlist.symbols.map(async (symbol) => {
          const priceRes = await priceService.getCurrentPrice(symbol, userCurrency);
          return { symbol, data: priceRes.data };
        })
      );

      return { success: true, data: { ...watchlist, marketData: data } };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getWatchlistData');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }
}

export const watchlistService = new WatchlistService();
