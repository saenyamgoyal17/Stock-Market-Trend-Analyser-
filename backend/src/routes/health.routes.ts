import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    let dbStatus = 'down';
    let redisStatus = 'down';
    let isOk = true;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'up';
    } catch (e) {
      isOk = false;
    }

    try {
      await redis.ping();
      redisStatus = 'up';
    } catch (e) {
      isOk = false;
    }

    const response = {
      status: isOk ? 'ok' : 'degraded',
      services: {
        database: dbStatus,
        redis: redisStatus,
        uptime: process.uptime()
      },
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString()
    };

    return reply.status(isOk ? 200 : 503).send(response);
  });
}
