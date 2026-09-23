import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { listStops } from './stops.service.js';

export const stopsRouter = Router();

stopsRouter.get('/', requireAuth, async (_req, res) => {
  res.json({ stops: await listStops() });
});
