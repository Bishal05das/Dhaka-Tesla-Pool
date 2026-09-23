import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, notFound } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound(`No route for ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    if (err.status >= 500) req.log.error({ err }, err.message);
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Malformed JSON body from express.json().
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body' } });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'VALIDATION_ERROR', message: 'Request body too large' } });
    return;
  }

  // Anything else is a bug: log the details, return nothing internal to the client.
  req.log.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};
