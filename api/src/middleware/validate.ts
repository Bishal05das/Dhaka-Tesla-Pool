import type { RequestHandler } from 'express';
import { z } from 'zod';
import { badRequest } from '../lib/errors.js';

type Part = 'body' | 'query' | 'params';

// Parses req[part] with the schema and stores the typed result in res.locals.validated[part],
// so handlers never touch unvalidated input. (Express 5 makes req.query read-only.)
export function validate(part: Part, schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    // Express 5 leaves req.body undefined when a request has no body (e.g. a bare
    // POST /api/pools/:id/arrive); treat that as {} so all-optional bodies still validate.
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      next(badRequest('Invalid request', z.flattenError(result.error).fieldErrors));
      return;
    }
    res.locals.validated = { ...res.locals.validated, [part]: result.data };
    next();
  };
}
