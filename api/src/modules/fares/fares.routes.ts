import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { type TripInput, tripSchema } from './fares.schemas.js';
import { quoteTrip } from './fares.service.js';

export const faresRouter = Router();

faresRouter.post(
  '/estimate',
  requireAuth,
  requireRole('PASSENGER'),
  validate('body', tripSchema),
  async (_req, res) => {
    res.json(await quoteTrip(res.locals.validated.body as TripInput));
  },
);
