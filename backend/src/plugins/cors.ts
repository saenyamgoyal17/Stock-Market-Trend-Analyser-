import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import { config } from '../config/index.js';

export default fp(async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyCors, {
    origin: config.app?.corsOrigins || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
});
