import type { RequestHandler } from 'express';
import type { Role } from '../generated/prisma/client.js';
import { forbidden, unauthenticated } from '../lib/errors.js';
import { readSession, SESSION_COOKIE } from '../lib/session.js';

// Puts the signed-in user in res.locals.user, or rejects with 401.
export const requireAuth: RequestHandler = (req, res, next) => {
  const user = readSession(req.cookies?.[SESSION_COOKIE]);
  if (!user) {
    next(unauthenticated());
    return;
  }
  res.locals.user = user;
  req.log = req.log.child({ userId: user.id });
  next();
};

// Use after requireAuth. A passenger calling a driver endpoint (or vice versa) gets 403.
export function requireRole(role: Role): RequestHandler {
  return (_req, res, next) => {
    if (res.locals.user?.role !== role) {
      next(forbidden(`Only ${role.toLowerCase()}s can do that`));
      return;
    }
    next();
  };
}
