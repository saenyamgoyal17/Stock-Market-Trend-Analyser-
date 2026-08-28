import { z } from 'zod';

export const fxRatesSchema = z.object({
  base: z.string().length(3).default('USD'),
  targets: z.string().transform(s => s.split(',').map(t => t.trim()))
});
export type FxRatesQuery = z.infer<typeof fxRatesSchema>;

export const fxConvertSchema = z.object({
  amount: z.coerce.number().positive(),
  from: z.string().length(3),
  to: z.string().length(3)
});
export type FxConvertBody = z.infer<typeof fxConvertSchema>;
