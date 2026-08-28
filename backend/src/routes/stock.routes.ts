import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { stockService } from '../services/stock.service.js';
import { priceService } from '../services/price.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import {
  stockSearchSchema,
  moversQuerySchema,
  stockHistorySchema
} from '../schemas/stock.schema.js';
import { symbolParamSchema } from '../schemas/common.schema.js';

export default async function stockRoutes(fastify: FastifyInstance) {
  fastify.get('/search', {
    schema: { querystring: stockSearchSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { q, exchange, country, limit } = request.query as any;
        const currency = request.user?.currency;
        const results = await stockService.search(q, exchange, country, limit, currency);
        return reply.send(successResponse(results));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('SEARCH_FAILED', error.message));
      }
    }
  });

  fastify.get('/movers/gainers', {
    schema: { querystring: moversQuerySchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { market, limit } = request.query as any;
        const results = await stockService.getMovers('gainers', market, limit);
        return reply.send(successResponse(results));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('MOVERS_FAILED', error.message));
      }
    }
  });

  fastify.get('/movers/losers', {
    schema: { querystring: moversQuerySchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { market, limit } = request.query as any;
        const results = await stockService.getMovers('losers', market, limit);
        return reply.send(successResponse(results));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('MOVERS_FAILED', error.message));
      }
    }
  });

  fastify.get('/movers/volatile', {
    schema: { querystring: moversQuerySchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { limit } = request.query as any;
        const results = await stockService.getMovers('volatile', undefined, limit);
        return reply.send(successResponse(results));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('MOVERS_FAILED', error.message));
      }
    }
  });

  fastify.get('/market-summary', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const summary = await stockService.getMarketSummary();
      return reply.send(successResponse(summary));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('MARKET_SUMMARY_FAILED', error.message));
    }
  });

  fastify.get('/:symbol', {
    schema: { params: symbolParamSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { symbol } = request.params as any;
        const stock = await stockService.getBySymbol(symbol);
        if (!stock) return reply.status(404).send(errorResponse('NOT_FOUND', 'Stock not found'));
        return reply.send(successResponse(stock));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('FETCH_FAILED', error.message));
      }
    }
  });

  fastify.get('/:symbol/price', {
    onRequest: [fastify.authenticate],
    schema: { params: symbolParamSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { symbol } = request.params as any;
        const { currency } = request.query as any;
        const price = await priceService.getCurrentPrice(symbol, currency);
        return reply.send(successResponse(price));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('PRICE_FETCH_FAILED', error.message));
      }
    }
  });

  fastify.get('/:symbol/history', {
    onRequest: [fastify.authenticate],
    schema: { params: symbolParamSchema, querystring: stockHistorySchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { symbol } = request.params as any;
        const { period, interval } = request.query as any;
        const history = await priceService.getHistory(symbol, period, interval);
        return reply.send(successResponse(history));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('HISTORY_FETCH_FAILED', error.message));
      }
    }
  });

  fastify.get('/:symbol/events', {
    onRequest: [fastify.authenticate],
    schema: { params: symbolParamSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { symbol } = request.params as any;
        const { limit, offset } = request.query as any;
        const events = await stockService.getStockEvents(symbol, limit, offset);
        return reply.send(successResponse(events));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('EVENTS_FETCH_FAILED', error.message));
      }
    }
  });

  fastify.get('/:symbol/fundamentals', {
    onRequest: [fastify.authenticate],
    schema: { params: symbolParamSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { symbol } = request.params as any;
        const fundamentals = await stockService.getFundamentals(symbol);
        return reply.send(successResponse(fundamentals));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('FUNDAMENTALS_FETCH_FAILED', error.message));
      }
    }
  });

  fastify.get('/:symbol/similar', {
    onRequest: [fastify.authenticate],
    schema: { params: symbolParamSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { symbol } = request.params as any;
        const similar = await stockService.getSimilar(symbol);
        return reply.send(successResponse(similar));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('SIMILAR_FETCH_FAILED', error.message));
      }
    }
  });
}
