import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fxService } from '../services/fx.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { fxRatesSchema, fxConvertSchema } from '../schemas/fx.schema.js';

export default async function fxRoutes(fastify: FastifyInstance) {
  fastify.get('/rates', {
    schema: { querystring: fxRatesSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { base, targets } = request.query as any;
        const rates = await fxService.getRates(base, targets);
        return reply.send(successResponse(rates));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('RATES_FAILED', error.message));
      }
    }
  });

  fastify.get('/convert', {
    schema: { querystring: fxConvertSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { amount, from, to } = request.query as any;
        const result = await fxService.convert(amount, from, to);
        return reply.send(successResponse(result));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('CONVERT_FAILED', error.message));
      }
    }
  });

  fastify.get('/supported-currencies', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const currencies = await fxService.getSupportedCurrencies();
      return reply.send(successResponse(currencies));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('CURRENCIES_FAILED', error.message));
    }
  });
}
