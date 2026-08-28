import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import { config } from '../config/index.js';

export default fp(async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyRateLimit, {
    max: (request) => {
      const role = request.user?.role || 'FREE';
      if (role === 'ENTERPRISE') return 10000;
      if (role === 'PRO') return 1000;
      return 100;
    },
    timeWindow: config.rateLimit?.window || '1 minute',
    keyGenerator: (request) => {
      return request.user?.id || request.ip;
    },
    errorResponseBuilder: (request, context) => {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded, retry in ${context.after}`
        }
      };
    }
  });
});
