import fastify from 'fastify';
import corsPlugin from '@fastify/cors';
import rateLimitPlugin from '@fastify/rate-limit';
import swaggerPlugin from '@fastify/swagger';
import swaggerUiPlugin from '@fastify/swagger-ui';
import { logger } from './lib/logger.js';
import authPlugin from './plugins/auth.js';
import errorHandlerPlugin from './plugins/error-handler.js';

import authRoutes from './routes/auth.routes.js';
import stockRoutes from './routes/stock.routes.js';
import eventRoutes from './routes/event.routes.js';
import marketRoutes from './routes/market.routes.js';
import fxRoutes from './routes/fx.routes.js';
import userRoutes from './routes/user.routes.js';
import healthRoutes from './routes/health.routes.js';
import webhookRoutes from './routes/webhook.routes.js';

export async function buildApp() {
  const app = fastify({
    logger,
    trustProxy: true
  });

  // Custom Zod schema validator compiler for Fastify
  app.setValidatorCompiler(({ schema }: any) => {
    return (data: any) => {
      if (schema && typeof schema.safeParse === 'function') {
        const result = schema.safeParse(data);
        if (result.success) {
          return { value: result.data };
        }
        return { error: result.error };
      }
      return { value: data };
    };
  });

  // Register basic security headers

  // Register plugins
  await app.register(corsPlugin, { origin: true });
  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  
  await app.register(rateLimitPlugin, {
    max: 100,
    timeWindow: '1 minute'
  });

  await app.register(swaggerPlugin, {
    swagger: {
      info: {
        title: 'PulseAI API',
        description: 'Backend API for PulseAI',
        version: '1.0.0'
      }
    }
  });
  await app.register(swaggerUiPlugin, {
    routePrefix: '/docs'
  });

  // Register routes
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(stockRoutes, { prefix: '/v1/stocks' });
  await app.register(eventRoutes, { prefix: '/v1/events' });
  await app.register(marketRoutes, { prefix: '/v1/markets' });
  await app.register(fxRoutes, { prefix: '/v1/fx' });
  await app.register(userRoutes, { prefix: '/v1/user' });
  await app.register(healthRoutes);
  await app.register(webhookRoutes, { prefix: '/v1' });

  return app;
}
