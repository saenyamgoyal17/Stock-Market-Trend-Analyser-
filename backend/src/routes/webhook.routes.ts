import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { priceService } from '../services/price.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

export default async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post('/webhooks/polygon', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Very basic validation could be implemented here (e.g. checking an API key header)
      const updates = request.body as any[];
      
      if (Array.isArray(updates)) {
        for (const update of updates) {
          if (update.sym && update.p) {
            await priceService.updateStockPrice(update.sym, update.p, update.c || 0, update.cp || 0);
          }
        }
      }
      
      return reply.send(successResponse({ processed: true }));
    } catch (error: any) {
      return reply.status(500).send(errorResponse('WEBHOOK_PROCESSING_FAILED', error.message));
    }
  });
}
