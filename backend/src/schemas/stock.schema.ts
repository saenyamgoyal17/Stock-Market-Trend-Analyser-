import { z } from 'zod';

export const stockSearchSchema = z.object({
  q: z.string().min(1).max(100),
  exchange: z.string().optional(),
  country: z.string().length(2).optional(),
  limit: z.coerce.number().min(1).max(50).default(20)
});
export type StockSearchQuery = z.infer<typeof stockSearchSchema>;

export const stockHistorySchema = z.object({
  period: z.enum(['1d','1w','1m','3m','6m','1y','5y']),
  interval: z.enum(['1m','5m','15m','1h','1d']).default('1d')
});
export type StockHistoryQuery = z.infer<typeof stockHistorySchema>;

export const moversQuerySchema = z.object({
  market: z.enum(['US','IN','UK','JP']).optional(),
  limit: z.coerce.number().min(1).max(50).default(10)
});
export type MoversQuery = z.infer<typeof moversQuerySchema>;
