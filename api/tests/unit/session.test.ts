import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { readSession } from '../../src/lib/session.js';

const SECRET = process.env.JWT_SECRET!;
const nusratId = '00000000-0000-4000-8000-000000000001';

const sign = (payload: object, secret = SECRET, opts: jwt.SignOptions = {}) =>
  jwt.sign(payload, secret, { algorithm: 'HS256', subject: nusratId, expiresIn: 60, ...opts });

describe('readSession', () => {
  it('accepts a valid token', () => {
    expect(readSession(sign({ role: 'PASSENGER' }))).toEqual({ id: nusratId, role: 'PASSENGER' });
  });

  it('rejects a token signed with another secret', () => {
    expect(readSession(sign({ role: 'DRIVER' }, 'someone-elses-secret-that-is-long-enough'))).toBeNull();
  });

  it('rejects an expired token', () => {
    expect(readSession(sign({ role: 'PASSENGER' }, SECRET, { expiresIn: -10 }))).toBeNull();
  });

  it('rejects an unsigned "alg: none" token', () => {
    const unsigned = jwt.sign({ role: 'DRIVER', sub: nusratId }, '', { algorithm: 'none' });
    expect(readSession(unsigned)).toBeNull();
  });

  it('rejects a token with an unknown role', () => {
    expect(readSession(sign({ role: 'ADMIN' }))).toBeNull();
  });

  it('rejects missing or garbage input', () => {
    expect(readSession(undefined)).toBeNull();
    expect(readSession('not-a-jwt')).toBeNull();
  });
});
