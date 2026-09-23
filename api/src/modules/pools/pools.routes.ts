import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { advancePool } from './pools.service.js';

export const poolsRouter = Router();

poolsRouter.use(requireAuth, requireRole('DRIVER'));

const params = z.object({
  id: z.uuid('Not a valid trip id'),
  action: z.enum(['arrive', 'start', 'complete', 'cancel']),
});
const body = z.object({ reason: z.string().trim().max(200).optional() });

// POST /api/pools/:id/arrive | start | complete | cancel
poolsRouter.post('/:id/:action', validate('params', params), validate('body', body), async (_req, res) => {
  const { id, action } = res.locals.validated.params as z.infer<typeof params>;
  const { reason } = res.locals.validated.body as z.infer<typeof body>;
  res.json({ pool: await advancePool(res.locals.user.id, id, action, reason) });
});
