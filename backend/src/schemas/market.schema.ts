import { z } from 'zod';

export const exchangeParamSchema = z.object({
  exchange: z.string().min(1).max(10)
});
export type ExchangeParam = z.infer<typeof exchangeParamSchema>;
