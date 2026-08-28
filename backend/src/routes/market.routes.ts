import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { marketService } from '../services/market.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { exchangeParamSchema } from '../schemas/market.schema.js';

export default async function marketRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const markets = await marketService.getMarkets();
      return reply.send(successResponse(markets));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('MARKET_LIST_FAILED', error.message));
    }
  });

  fastify.get('/global-snapshot', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const snapshot = await marketService.getGlobalSnapshot();
      return reply.send(successResponse(snapshot));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('SNAPSHOT_FAILED', error.message));
    }
  });

  fastify.get('/:exchange/status', {
    schema: { params: exchangeParamSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { exchange } = request.params as any;
        const status = await marketService.getExchangeStatus(exchange);
        return reply.send(successResponse(status));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('EXCHANGE_STATUS_FAILED', error.message));
      }
    }
  });
}
