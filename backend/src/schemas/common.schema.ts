import { z } from 'zod';

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  page: z.coerce.number().min(1).optional()
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const idParamSchema = z.object({
  id: z.string().uuid()
});
export type IdParam = z.infer<typeof idParamSchema>;

export const symbolParamSchema = z.object({
  symbol: z.string().min(1).max(10).regex(/^[A-Z0-9.]+$/i, 'Invalid stock symbol')
});
export type SymbolParam = z.infer<typeof symbolParamSchema>;

export const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});
export type DateRange = z.infer<typeof dateRangeSchema>;

export function standardResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.object({
      total: z.number().optional(),
      page: z.number().optional(),
      limit: z.number().optional(),
      hasMore: z.boolean().optional()
    }).optional()
  });
}

export const standardErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  })
});
export type StandardError = z.infer<typeof standardErrorSchema>;
