import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { type RequestRideInput, requestRideSchema, rideIdParams } from './rides.schemas.js';
import * as rides from './rides.service.js';

export const ridesRouter = Router();

ridesRouter.use(requireAuth, requireRole('PASSENGER'));

ridesRouter.post('/', validate('body', requestRideSchema), async (_req, res) => {
  const ride = await rides.requestRide(res.locals.user.id, res.locals.validated.body as RequestRideInput);
  res.status(201).json({ ride });
});

ridesRouter.get('/', async (_req, res) => {
  res.json({ rides: await rides.listRides(res.locals.user.id) });
});

ridesRouter.get('/:id', validate('params', rideIdParams), async (_req, res) => {
  const { id } = res.locals.validated.params as { id: string };
  res.json({ ride: await rides.getRide(res.locals.user.id, id) });
});
