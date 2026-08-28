import 'dotenv/config';
import { buildApp } from './app.js';
import { logger } from './lib/logger.js';
import { initializeQueues } from './jobs/queues.js';
import { startWebSocketServer } from './ws/server.js';
import { config } from './config/index.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';

async function start() {
  try {
    const app = await buildApp();

    await app.listen({ port: config.app.port, host: '0.0.0.0' });
    logger.info(`PulseAI API running on port ${config.app.port}`);

    try {
      await initializeQueues();
      logger.info('Queues initialized successfully');
    } catch (err: any) {
      logger.warn(`Failed to initialize queues: ${err.message}`);
    }

    try {
      startWebSocketServer(app.server);
      logger.info('WebSocket server started successfully');
    } catch (err: any) {
      logger.warn(`Failed to start WebSocket server: ${err.message}`);
    }

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down server...');
      await app.close();
      await prisma.$disconnect();
      redis.disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();
