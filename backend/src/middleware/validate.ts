import { FastifyRequest } from 'fastify';
import { z } from 'zod';

export function validateBody<T extends z.ZodSchema>(schema: T) {
  return async (request: FastifyRequest) => {
    request.body = schema.parse(request.body);
  };
}

export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return async (request: FastifyRequest) => {
    request.query = schema.parse(request.query) as any;
  };
}

export function validateParams<T extends z.ZodSchema>(schema: T) {
  return async (request: FastifyRequest) => {
    request.params = schema.parse(request.params) as any;
  };
}
