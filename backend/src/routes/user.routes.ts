import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { watchlistService } from '../services/watchlist.service.js';
import { alertService } from '../services/alert.service.js';
import { portfolioService } from '../services/portfolio.service.js';
import { searchService } from '../services/search.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import {
  createWatchlistSchema,
  addSymbolSchema,
  createAlertSchema,
  addHoldingSchema
} from '../schemas/user.schema.js';

export default async function userRoutes(fastify: FastifyInstance) {
  // All routes in this plugin require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/watchlists', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const watchlists = await watchlistService.getUserWatchlists(request.user!.id);
      return reply.send(successResponse(watchlists));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('WATCHLIST_FETCH_FAILED', error.message));
    }
  });

  fastify.post('/watchlists', {
    schema: { body: createWatchlistSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as any;
        const watchlist = await watchlistService.create(request.user!.id, body.name, body.symbols || []);
        return reply.status(201).send(successResponse(watchlist));
      } catch (error: any) {
        return reply.status(400).send(errorResponse('WATCHLIST_CREATE_FAILED', error.message));
      }
    }
  });

  fastify.put('/watchlists/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const watchlist = await watchlistService.update(request.user!.id, id, request.body as any);
      return reply.send(successResponse(watchlist));
    } catch (error: any) {
      return reply.status(400).send(errorResponse('WATCHLIST_UPDATE_FAILED', error.message));
    }
  });

  fastify.delete('/watchlists/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      await watchlistService.delete(request.user!.id, id);
      return reply.send(successResponse({ success: true }));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('WATCHLIST_DELETE_FAILED', error.message));
    }
  });

  fastify.post('/watchlists/:id/symbols', {
    schema: { body: addSymbolSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as any;
        const { symbol } = request.body as any;
        const watchlist = await watchlistService.addSymbol(request.user!.id, id, symbol);
        return reply.send(successResponse(watchlist));
      } catch (error: any) {
        return reply.status(400).send(errorResponse('SYMBOL_ADD_FAILED', error.message));
      }
    }
  });

  fastify.delete('/watchlists/:id/symbols/:symbol', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, symbol } = request.params as any;
      const watchlist = await watchlistService.removeSymbol(request.user!.id, id, symbol);
      return reply.send(successResponse(watchlist));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('SYMBOL_REMOVE_FAILED', error.message));
    }
  });

  fastify.get('/watchlists/:id/data', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const data = await watchlistService.getWatchlistData(request.user!.id, id, request.user?.currency || 'USD');
      return reply.send(successResponse(data));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('WATCHLIST_DATA_FAILED', error.message));
    }
  });

  fastify.get('/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const alerts = await alertService.getUserAlerts(request.user!.id);
      return reply.send(successResponse(alerts));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('ALERTS_FETCH_FAILED', error.message));
    }
  });

  fastify.post('/alerts', {
    schema: { body: createAlertSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as any;
        const alert = await alertService.create(request.user!.id, body);
        return reply.status(201).send(successResponse(alert));
      } catch (error: any) {
        return reply.status(400).send(errorResponse('ALERT_CREATE_FAILED', error.message));
      }
    }
  });

  fastify.put('/alerts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const alert = await alertService.update(request.user!.id, id, request.body as any);
      return reply.send(successResponse(alert));
    } catch (error: any) {
      return reply.status(400).send(errorResponse('ALERT_UPDATE_FAILED', error.message));
    }
  });

  fastify.delete('/alerts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      await alertService.delete(request.user!.id, id);
      return reply.send(successResponse({ success: true }));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('ALERT_DELETE_FAILED', error.message));
    }
  });

  fastify.get('/portfolio', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const portfolio = await portfolioService.getUserPortfolio(request.user!.id);
      return reply.send(successResponse(portfolio));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('PORTFOLIO_FETCH_FAILED', error.message));
    }
  });

  fastify.post('/portfolio/holdings', {
    schema: { body: addHoldingSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const holding = await portfolioService.addHolding(request.user!.id, request.body as any);
        return reply.send(successResponse(holding));
      } catch (error: any) {
        return reply.status(400).send(errorResponse('HOLDING_ADD_FAILED', error.message));
      }
    }
  });

  fastify.delete('/portfolio/holdings/:symbol', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { symbol } = request.params as any;
      await portfolioService.removeHolding(request.user!.id, symbol);
      return reply.send(successResponse({ success: true }));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('HOLDING_REMOVE_FAILED', error.message));
    }
  });

  fastify.get('/portfolio/performance', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const performance = await portfolioService.getPerformance(request.user!.id, request.user?.currency || 'USD');
      return reply.send(successResponse(performance));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('PERFORMANCE_FAILED', error.message));
    }
  });

  fastify.get('/search-history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const history = await searchService.getUserHistory(request.user!.id);
      return reply.send(successResponse(history));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('HISTORY_FETCH_FAILED', error.message));
    }
  });

  fastify.delete('/search-history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await searchService.clearHistory(request.user!.id);
      return reply.send(successResponse({ success: true }));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('HISTORY_CLEAR_FAILED', error.message));
    }
  });
}
