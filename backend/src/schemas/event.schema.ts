import { z } from 'zod';
import { paginationQuerySchema } from './common.schema.js';

export enum EventCategory {
  POLITICAL = 'POLITICAL',
  MILITARY = 'MILITARY',
  ECONOMIC = 'ECONOMIC',
  GEOPOLITICAL = 'GEOPOLITICAL',
  ENVIRONMENTAL = 'ENVIRONMENTAL',
  EARNINGS = 'EARNINGS',
  REGULATORY = 'REGULATORY'
}

export enum EventSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export const eventListSchema = paginationQuerySchema.extend({
  category: z.nativeEnum(EventCategory).optional(),
  severity: z.nativeEnum(EventSeverity).optional(),
  country: z.string().length(2).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});
export type EventListQuery = z.infer<typeof eventListSchema>;

export const eventSearchSchema = z.object({
  q: z.string().min(1).max(500)
});
export type EventSearchQuery = z.infer<typeof eventSearchSchema>;

export const eventAnalyzeSchema = z.object({
  text: z.string().min(10).max(5000),
  targetSymbols: z.array(z.string()).max(20).optional()
});
export type EventAnalyzeBody = z.infer<typeof eventAnalyzeSchema>;

export const impactMatrixSchema = z.object({
  sectors: z.array(z.string()),
  eventTypes: z.array(z.string()).optional()
});
export type ImpactMatrixBody = z.infer<typeof impactMatrixSchema>;
