import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError } from '../../src/lib/errors.js';
import { validate } from '../../src/middleware/validate.js';

const schema = z.object({ seats: z.coerce.number().int().min(1).max(3) });

function run(body: unknown) {
  const req = { body } as Request;
  const res = { locals: {} } as Response;
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
  validate('body', schema)(req, res, next);
  return { res, next };
}

describe('validate middleware', () => {
  it('stores the parsed, typed value', () => {
    const { res, next } = run({ seats: '2' });
    expect(next).toHaveBeenCalledWith();
    expect(res.locals.validated.body).toEqual({ seats: 2 });
  });

  it('passes a 400 AppError with field details on invalid input', () => {
    const { next } = run({ seats: 4 });
    const err = next.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
    expect(err.details).toHaveProperty('seats');
  });
});
