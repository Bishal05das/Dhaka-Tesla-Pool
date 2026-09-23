import { Router } from 'express';
import { env } from '../../config/env.js';
import { requireAuth } from '../../middleware/auth.js';
import { authRateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

export const authRouter = Router();

// One shared budget for sign-up and login attempts per IP.
const limiter = authRateLimit(env.AUTH_RATE_LIMIT_MAX);

authRouter.post('/register', limiter, validate('body', registerSchema), controller.register);
authRouter.post('/login', limiter, validate('body', loginSchema), controller.login);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', requireAuth, controller.me);
