import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { getWallet, topUp } from './wallet.service.js';

export const walletRouter = Router();

walletRouter.use(requireAuth, requireRole('PASSENGER'));

// Simulated top-up: no real gateway. ৳1 to ৳5,000 per top-up, in poisha.
const topUpSchema = z.object({
  amountPoisha: z.number().int('Whole poisha only').min(100, 'At least ৳1').max(500_000, 'At most ৳5,000 at a time'),
});

walletRouter.get('/', async (_req, res) => {
  res.json(await getWallet(res.locals.user.id));
});

walletRouter.post('/topup', validate('body', topUpSchema), async (_req, res) => {
  const { amountPoisha } = res.locals.validated.body as z.infer<typeof topUpSchema>;
  res.json(await topUp(res.locals.user.id, amountPoisha));
});
