import { ApiResponse, ApiError, ErrorCode, PaginationMeta } from '../types/api.js';

export function successResponse<T>(data: T, meta?: PaginationMeta): ApiResponse<T> {
  return {
    success: true,
    data,
    meta,
  };
}

export function errorResponse(code: ErrorCode, message: string, details?: unknown): ApiError {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

export function paginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}
