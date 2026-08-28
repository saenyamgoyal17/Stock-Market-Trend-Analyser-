import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eventService } from '../services/event.service.js';
import { aiService } from '../services/ai.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import {
  eventListSchema,
  eventSearchSchema,
  impactMatrixSchema,
  eventAnalyzeSchema
} from '../schemas/event.schema.js';
import { idParamSchema } from '../schemas/common.schema.js';

export default async function eventRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    schema: { querystring: eventListSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const filters = request.query as any;
        const events = await eventService.list(filters);
        return reply.send(successResponse(events));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('EVENT_LIST_FAILED', error.message));
      }
    }
  });

  fastify.get('/latest', {
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { limit } = request.query as any;
        const events = await eventService.getLatest(limit);
        return reply.send(successResponse(events));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('LATEST_EVENTS_FAILED', error.message));
      }
    }
  });

  fastify.get('/search', {
    schema: { querystring: eventSearchSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { q } = request.query as any;
        const events = await eventService.search(q);
        return reply.send(successResponse(events));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('EVENT_SEARCH_FAILED', error.message));
      }
    }
  });

  fastify.get('/impact-matrix', {
    schema: { querystring: impactMatrixSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { sectors, eventTypes } = request.query as any;
        const matrix = await eventService.getImpactMatrix(sectors, eventTypes);
        return reply.send(successResponse(matrix));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('IMPACT_MATRIX_FAILED', error.message));
      }
    }
  });

  fastify.post('/analyze', {
    onRequest: [fastify.authenticate, fastify.requireRole(['PRO', 'ENTERPRISE'])],
    schema: { body: eventAnalyzeSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { text, targetSymbols } = request.body as any;
        const analysis = await aiService.analyzeCustomText(text, targetSymbols);
        return reply.send(successResponse(analysis));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('ANALYSIS_FAILED', error.message));
      }
    }
  });

  fastify.get('/:id', {
    schema: { params: idParamSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as any;
        const event = await eventService.getById(id);
        if (!event) return reply.status(404).send(errorResponse('NOT_FOUND', 'Event not found'));
        return reply.send(successResponse(event));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('EVENT_FETCH_FAILED', error.message));
      }
    }
  });

  fastify.get('/:id/stocks', {
    schema: { params: idParamSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as any;
        const stocks = await eventService.getEventStocks(id);
        return reply.send(successResponse(stocks));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('EVENT_STOCKS_FAILED', error.message));
      }
    }
  });

  fastify.get('/:id/sectors', {
    schema: { params: idParamSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as any;
        const sectors = await eventService.getEventSectors(id);
        return reply.send(successResponse(sectors));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('EVENT_SECTORS_FAILED', error.message));
      }
    }
  });
}
