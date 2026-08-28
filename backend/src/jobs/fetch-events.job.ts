import { createWorker, createQueue } from '../lib/queue.js';
import { QUEUE_NAMES } from './queues.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import crypto from 'crypto';
import { EventCategory } from '@prisma/client';
import { newsApiClient } from '../clients/newsapi.client.js';
import { gdeltClient } from '../clients/gdelt.client.js';
import { fmpClient } from '../clients/fmp.client.js';

const analyzeEventQueue = createQueue(QUEUE_NAMES.ANALYZE_EVENT);

function generateEventHash(url: string, title: string) {
  return crypto.createHash('sha256').update(`${url}:${title}`).digest('hex');
}

function categorizeEvent(title: string, body: string): EventCategory {
  const text = `${title} ${body}`.toLowerCase();
  if (/(war|military|conflict|troops)/.test(text)) return EventCategory.MILITARY;
  if (/(election|government|policy|political)/.test(text)) return EventCategory.POLITICAL;
  if (/(tariff|trade|gdp|inflation|interest rate)/.test(text)) return EventCategory.ECONOMIC;
  if (/(sanctions|treaty|diplomacy|geopolitical)/.test(text)) return EventCategory.GEOPOLITICAL;
  if (/(climate|earthquake|hurricane|environmental)/.test(text)) return EventCategory.ENVIRONMENTAL;
  if (/(earnings|revenue|profit|quarterly)/.test(text)) return EventCategory.EARNINGS;
  if (/(regulation|sec|compliance|law)/.test(text)) return EventCategory.REGULATORY;
  return EventCategory.ECONOMIC;
}

createWorker(QUEUE_NAMES.FETCH_EVENTS, async (job) => {
  try {
    let rawEvents: any[] = [];
    
    try {
      const geoNews: any = await newsApiClient.getGeopoliticalNews();
      const finNews: any = await newsApiClient.getFinancialNews();
      rawEvents.push(...(geoNews?.articles || geoNews || []));
      rawEvents.push(...(finNews?.articles || finNews || []));
    } catch(e) {}
    
    try {
      const gCon: any = await gdeltClient.getConflictEvents();
      const gPol: any = await gdeltClient.getPoliticalEvents();
      const gEco: any = await gdeltClient.getEconomicEvents();
      rawEvents.push(...(gCon?.articles || gCon || []));
      rawEvents.push(...(gPol?.articles || gPol || []));
      rawEvents.push(...(gEco?.articles || gEco || []));
    } catch(e) {}

    try {
      const fmpNews: any = await fmpClient.getStockNews();
      rawEvents.push(...(fmpNews?.articles || fmpNews || []));
    } catch(e) {}

    let newCount = 0;

    for (const item of rawEvents) {
      if (!item.title || !item.url) continue;

      const hash = generateEventHash(item.url, item.title);
      const existing = await prisma.worldEvent.findFirst({ where: { sourceUrl: item.url } });
      
      if (existing) continue;

      const category = categorizeEvent(item.title, item.body || '');
      
      const newEvent = await prisma.worldEvent.create({
        data: {
          title: item.title,
          body: item.body || '',
          sourceUrl: item.url,
          sourceName: item.sourceName || 'Unknown',
          publishedAt: new Date(item.publishedAt || Date.now()),
          category,
          severity: 'MEDIUM',
          sentiment: 0,
          isProcessed: false
        }
      });

      await analyzeEventQueue.add('analyze-event', { eventId: newEvent.id });
      newCount++;
    }

    logger.info(`${newCount} new events detected`);
  } catch (error) {
    logger.error({ err: error }, 'Error in fetch-events job');
  }
});
