import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional().default(''),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  REDIS_URL: z.string().url(),
  POLYGON_IO_API_KEY: z.string().optional().default(''),
  FINNHUB_API_KEY: z.string().optional().default(''),
  NEWSAPI_KEY: z.string().optional().default(''),
  FMP_API_KEY: z.string().optional().default(''),
  BENZINGA_API_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  EXCHANGE_RATE_API_KEY: z.string().optional().default(''),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  PORT: z.string().transform(Number).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32).optional().default('your-jwt-secret-minimum-32-chars-default'),
  BASE_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().transform((val) => val.split(',')).default('http://localhost:5173,http://localhost:3000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('60000'),
});

const env = envSchema.parse(process.env);

export const config = {
  db: {
    url: env.DATABASE_URL,
    directUrl: env.DIRECT_URL,
  },
  supabase: {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  },
  redis: {
    url: env.REDIS_URL,
  },
  polygon: {
    apiKey: env.POLYGON_IO_API_KEY,
  },
  finnhub: {
    apiKey: env.FINNHUB_API_KEY,
  },
  newsapi: {
    apiKey: env.NEWSAPI_KEY,
  },
  fmp: {
    apiKey: env.FMP_API_KEY,
  },
  anthropic: {
    apiKey: env.ANTHROPIC_API_KEY,
  },
  exchangeRate: {
    apiKey: env.EXCHANGE_RATE_API_KEY,
  },
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  },
  app: {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    jwtSecret: env.JWT_SECRET,
    baseUrl: env.BASE_URL,
    frontendUrl: env.FRONTEND_URL,
    corsOrigins: env.CORS_ORIGINS,
  },
  rateLimit: {
    max: env.RATE_LIMIT_MAX,
    window: env.RATE_LIMIT_WINDOW,
  },
};
