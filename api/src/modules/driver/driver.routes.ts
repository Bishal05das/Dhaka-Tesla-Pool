import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as driver from './driver.service.js';

export const driverRouter = Router();

driverRouter.use(requireAuth, requireRole('DRIVER'));

const statusSchema = z.object({ online: z.boolean() });

driverRouter.patch('/status', validate('body', statusSchema), async (_req, res) => {
  const { online } = res.locals.validated.body as z.infer<typeof statusSchema>;
  res.json(await driver.setOnline(res.locals.user.id, online));
});

driverRouter.get('/requests', async (_req, res) => {
  res.json(await driver.listOpenRequests(res.locals.user.id));
});

const rideIdParams = z.object({ id: z.uuid('Not a valid ride id') });

driverRouter.post('/requests/:id/accept', validate('params', rideIdParams), async (_req, res) => {
  const { id } = res.locals.validated.params as z.infer<typeof rideIdParams>;
  res.json({ pool: await driver.acceptRequest(res.locals.user.id, id) });
});

driverRouter.get('/pool', async (_req, res) => {
  res.json({ pool: await driver.getCurrentPool(res.locals.user.id) });
});
