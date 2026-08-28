import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { config } from '../config/index.js';

export default fp(async function swaggerPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'PulseAI API',
        description: 'Real-Time Stock Market Event Impact Analyzer',
        version: '1.0.0'
      },
      servers: [
        {
          url: config.app?.baseUrl || 'http://localhost:3000'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    }
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs'
  });
});
