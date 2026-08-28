import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

class SearchService {
  async recordSearch(userId: string, query: string, symbol?: string) {
    try {
      const search = await prisma.searchHistory.create({
        data: { userId, query, symbol }
      });
      return { success: true, data: search };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in recordSearch');
      return { success: false, error: { code: 'CREATE_FAILED', message: error.message } };
    }
  }

  async getUserHistory(userId: string, limit: number = 50) {
    try {
      const history = await prisma.searchHistory.findMany({
        where: { userId },
        
        take: limit
      });
      return { success: true, data: history };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getUserHistory');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async clearHistory(userId: string) {
    try {
      await prisma.searchHistory.deleteMany({
        where: { userId }
      });
      return { success: true, data: null };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in clearHistory');
      return { success: false, error: { code: 'DELETE_FAILED', message: error.message } };
    }
  }
}

export const searchService = new SearchService();
