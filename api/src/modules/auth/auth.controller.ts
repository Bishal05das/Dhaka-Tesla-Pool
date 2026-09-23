import type { RequestHandler } from 'express';
import { clearSession, issueSession } from '../../lib/session.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import * as authService from './auth.service.js';

export const register: RequestHandler = async (_req, res) => {
  const user = await authService.register(res.locals.validated.body as RegisterInput);
  issueSession(res, user);
  res.status(201).json({ user });
};

export const login: RequestHandler = async (_req, res) => {
  const user = await authService.login(res.locals.validated.body as LoginInput);
  issueSession(res, user);
  res.json({ user });
};

export const logout: RequestHandler = (_req, res) => {
  clearSession(res);
  res.status(204).end();
};

export const me: RequestHandler = async (_req, res) => {
  res.json({ user: await authService.getUser(res.locals.user.id) });
};
