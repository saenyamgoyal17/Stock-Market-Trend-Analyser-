import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { aiService } from './ai.service.js';

class EventService {
  async list(filters: { category?: any; severity?: any; country?: string; from?: Date; to?: Date; limit?: number; offset?: number }) {
    try {
      const where: any = {};
      if (filters.category) where.category = filters.category;
      if (filters.severity) where.severity = filters.severity;
      if (filters.country) where.country = filters.country;
      if (filters.from || filters.to) {
        where.publishedAt = {};
        if (filters.from) where.publishedAt.gte = filters.from;
        if (filters.to) where.publishedAt.lte = filters.to;
      }

      const [total, events] = await Promise.all([
        prisma.worldEvent.count({ where }),
        prisma.worldEvent.findMany({
          where,
          orderBy: { publishedAt: 'desc' },
          take: filters.limit || 20,
          skip: filters.offset || 0,
          include: {
            _count: {
              select: { stockEvents: true }
            }
          }
        })
      ]);

      return { success: true, data: events, meta: { total, limit: filters.limit || 20, offset: filters.offset || 0 } };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in event list');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async getById(id: string) {
    try {
      const event = await prisma.worldEvent.findUnique({
        where: { id },
        include: { stockEvents: { include: { stock: true } } }
      });
      if (!event) throw new Error('Event not found');
      return { success: true, data: event };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getById');
      return { success: false, error: { code: 'NOT_FOUND', message: error.message } };
    }
  }

  async getLatest(limit: number = 10) {
    try {
      const events = await prisma.worldEvent.findMany({
        orderBy: { publishedAt: 'desc' },
        take: limit
      });
      return { success: true, data: events };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getLatest');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async getEventStocks(eventId: string) {
    try {
      const stocks = await prisma.stockEvent.findMany({
        where: { eventId },
        include: { stock: true }
      });
      return { success: true, data: stocks };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getEventStocks');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async getEventSectors(eventId: string) {
    try {
      const sectors = await prisma.sectorImpact.findMany({
        where: { eventId }
      });
      return { success: true, data: sectors };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getEventSectors');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async getImpactMatrix(sectors: string[], eventTypes?: string[]) {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const impacts = await prisma.sectorImpact.findMany({
        where: {
          sector: { in: sectors },
          calculatedAt: { gte: thirtyDaysAgo },
          /* Removed invalid relation query */
        },
        
      });
      
      const matrix: Record<string, Record<string, number>> = {};
      // Calculate averages here...
      return { success: true, data: matrix };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getImpactMatrix');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async search(query: string) {
    try {
      const criteria = await aiService.semanticSearch(query);
      if (!criteria.success) throw new Error('AI analysis failed');
      
      const events = await prisma.worldEvent.findMany({
        where: {
          title: { contains: criteria.data?.keywords?.[0] || query, mode: 'insensitive' }
        },
        take: 20
      });
      
      return { success: true, data: events };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in event search');
      return { success: false, error: { code: 'SEARCH_FAILED', message: error.message } };
    }
  }

  async createEvent(data: any) {
    try {
      const event = await prisma.worldEvent.create({ data });
      return { success: true, data: event };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in createEvent');
      return { success: false, error: { code: 'CREATE_FAILED', message: error.message } };
    }
  }

  async markProcessed(eventId: string, aiSummary: string, sentiment: number) {
    try {
      const event = await prisma.worldEvent.update({
        where: { id: eventId },
        data: { isProcessed: true, aiSummary, sentiment }
      });
      return { success: true, data: event };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in markProcessed');
      return { success: false, error: { code: 'UPDATE_FAILED', message: error.message } };
    }
  }
}

export const eventService = new EventService();
