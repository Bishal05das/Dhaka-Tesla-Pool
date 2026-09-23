import express, { type Express } from 'express';
import { requestLogger } from './middleware/requestLogger.js';

export function createApp(): Express {
  const app = express();

  app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
