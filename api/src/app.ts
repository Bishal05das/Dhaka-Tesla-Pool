import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

export function createApp(): Express {
  const app = express();

  // Render/Vercel sit in front of the API; trust one proxy hop so req.ip and
  // req.secure reflect the real client (needed for rate limiting and secure cookies).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestLogger);
  app.use(helmet());
  // The web app normally reaches the API through its same-origin /api rewrite, so CORS
  // only matters for direct calls; allow just the configured origins, with cookies.
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
