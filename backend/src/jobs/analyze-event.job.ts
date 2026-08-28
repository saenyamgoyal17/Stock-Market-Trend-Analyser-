import { createWorker } from '../lib/queue.js';
import { QUEUE_NAMES } from './queues.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { aiService } from '../services/ai.service.js';
import { stockService } from '../services/stock.service.js';
import { priceService } from '../services/price.service.js';
import { eventService } from '../services/event.service.js';
import { alertService } from '../services/alert.service.js';
import { broadcastNewEvent } from '../ws/broadcaster.js';

createWorker(QUEUE_NAMES.ANALYZE_EVENT, async (job) => {
  try {
    const { eventId } = job.data;
    const event = await prisma.worldEvent.findUnique({ where: { id: eventId } });
    
    if (!event || event.isProcessed) return;

    const result = await aiService.analyzeEvent({
      title: event.title,
      body: event.body,
      category: event.category,
      publishedAt: event.publishedAt
    });

    // aiService.analyzeEvent returns { success, data } or { success, error }
    if (!result.success || !('data' in result) || !result.data) {
      logger.warn(`AI analysis failed for event ${eventId}`);
      return;
    }

    const analysis = result.data as any;
    const affectedStocksData: Array<{ symbol: string; reason: string }> = [];

    for (const affected of analysis.affectedStocks || []) {
      let stock = await prisma.stock.findUnique({ where: { symbol: affected.symbol } });
      if (!stock) {
        const syncResult = await stockService.syncStockFromApi(affected.symbol);
        stock = (syncResult as any)?.data ?? null;
      }
      
      if (stock) {
        const currentPriceData = await priceService.getCurrentPrice(affected.symbol);
        const currentPrice = typeof currentPriceData === 'number' ? currentPriceData : (currentPriceData as any)?.price ?? stock.lastPrice ?? 0;
        
        await prisma.stockEvent.create({
          data: {
            stockId: stock.id,
            eventId: event.id,
            priceAtEvent: currentPrice,
            aiConfidence: affected.confidence,
            aiImpactReason: affected.reason
          }
        });
        
        affectedStocksData.push({ symbol: stock.symbol, reason: affected.reason });
      }
    }

    const sectorsData: Array<{ name: string }> = [];
    for (const sector of analysis.affectedSectors || []) {
      await prisma.sectorImpact.create({
        data: {
          eventId: event.id,
          sector: sector.name,
          changeAvg: 0,
          stockCount: 0
        }
      });
      sectorsData.push({ name: sector.name });
    }

    const sentimentValue = typeof analysis.overallSentiment === 'number' ? analysis.overallSentiment : 0;
    await eventService.markProcessed(event.id, analysis.summary || '', sentimentValue);
    
    const updatedEvent = await prisma.worldEvent.findUnique({ where: { id: event.id } });
    
    if (updatedEvent) {
      broadcastNewEvent({
        id: updatedEvent.id,
        title: updatedEvent.title,
        category: updatedEvent.category,
        severity: updatedEvent.severity,
        sentiment: updatedEvent.sentiment,
        stocks: affectedStocksData,
        sectors: sectorsData
      });
      
      await alertService.checkEventAlerts(updatedEvent);
    }

    logger.info(`Event analyzed: ${event.title}, ${affectedStocksData.length} stocks affected`);
  } catch (error) {
    logger.error({ err: error }, 'Error in analyze-event job');
  }
}, { concurrency: 3 });
