import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';

export const prisma = new PrismaClient(
  config.app.nodeEnv === 'development' 
    ? { log: ['query' as const, 'info' as const, 'warn' as const, 'error' as const] } 
    : undefined
);
