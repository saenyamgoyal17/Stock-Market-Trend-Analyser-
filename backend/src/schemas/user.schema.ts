import { z } from 'zod';

export const createWatchlistSchema = z.object({
  name: z.string().min(1).max(100),
  symbols: z.array(z.string().max(10)).min(1).max(50)
});
export type CreateWatchlistBody = z.infer<typeof createWatchlistSchema>;

export const updateWatchlistSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  symbols: z.array(z.string().max(10)).optional()
});
export type UpdateWatchlistBody = z.infer<typeof updateWatchlistSchema>;

export const addSymbolSchema = z.object({
  symbol: z.string().min(1).max(10)
});
export type AddSymbolBody = z.infer<typeof addSymbolSchema>;

export const createAlertSchema = z.object({
  symbol: z.string().max(10),
  alertType: z.enum(['PRICE_CHANGE_UP','PRICE_CHANGE_DOWN','EVENT_DETECTED','SECTOR_MOVE']),
  threshold: z.number().optional(),
  eventCategory: z.enum(['POLITICAL','MILITARY','ECONOMIC','GEOPOLITICAL','ENVIRONMENTAL','EARNINGS','REGULATORY']).optional()
});
export type CreateAlertBody = z.infer<typeof createAlertSchema>;

export const updateAlertSchema = z.object({
  alertType: z.enum(['PRICE_CHANGE_UP','PRICE_CHANGE_DOWN','EVENT_DETECTED','SECTOR_MOVE']).optional(),
  threshold: z.number().optional(),
  eventCategory: z.enum(['POLITICAL','MILITARY','ECONOMIC','GEOPOLITICAL','ENVIRONMENTAL','EARNINGS','REGULATORY']).optional(),
  isActive: z.boolean().optional()
});
export type UpdateAlertBody = z.infer<typeof updateAlertSchema>;

export const addHoldingSchema = z.object({
  symbol: z.string().max(10),
  quantity: z.number().positive(),
  avgBuyPrice: z.number().positive(),
  currency: z.string().length(3).default('USD')
});
export type AddHoldingBody = z.infer<typeof addHoldingSchema>;
