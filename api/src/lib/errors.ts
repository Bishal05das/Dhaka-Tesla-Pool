// Every error the API returns has the shape { error: { code, message, details? } }.
// Services throw AppError; the error handler turns it into that response.

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_TRANSITION'
  | 'CAPACITY_EXCEEDED'
  | 'INSUFFICIENT_BALANCE'
  | 'NO_TESLA_AVAILABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);
export const unauthenticated = (message = 'Please sign in') =>
  new AppError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'You are not allowed to do that') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Not found') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code: ErrorCode, message: string, details?: unknown) =>
  new AppError(409, code, message, details);
