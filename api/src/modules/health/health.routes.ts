import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

export const healthRouter = Router();

// Used by Docker/Render health checks: healthy only if the database answers.
healthRouter.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'ok' });
  } catch (err) {
    req.log.error({ err }, 'Health check: database unreachable');
    res.status(503).json({ status: 'degraded', db: 'unreachable' });
  }
});
