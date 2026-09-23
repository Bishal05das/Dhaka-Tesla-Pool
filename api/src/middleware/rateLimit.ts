import { rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/errors.js';

// Slows down password guessing and sign-up spam per client IP. The counter lives in this
// process's memory: fine for one API instance; several instances would need a shared store.
export function authRateLimit(maxPerWindow: number, windowMs = 15 * 60 * 1000) {
  return rateLimit({
    windowMs,
    limit: maxPerWindow,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please wait a few minutes and try again.'));
    },
  });
}
