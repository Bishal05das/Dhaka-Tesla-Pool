import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from '../generated/prisma/client.js';

// Session = a signed JWT in an httpOnly cookie. JavaScript in the page can't read it (XSS can't
// steal it), and SameSite=Lax stops other sites from sending it on cross-site POSTs (CSRF).
export const SESSION_COOKIE = 'dt_session';

export interface AuthUser {
  id: string;
  role: Role;
}

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax',
  path: '/',
});

export function issueSession(res: Response, user: AuthUser) {
  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: user.id,
    expiresIn: env.JWT_TTL_HOURS * 3600,
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: env.JWT_TTL_HOURS * 3600 * 1000 });
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

// Returns null for a missing, expired, tampered or malformed token.
export function readSession(token: unknown): AuthUser | null {
  if (typeof token !== 'string' || !token) return null;
  try {
    // Pin the algorithm so a token can't choose its own (e.g. "none").
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub) return null;
    if (payload.role !== 'PASSENGER' && payload.role !== 'DRIVER') return null;
    return { id: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}
