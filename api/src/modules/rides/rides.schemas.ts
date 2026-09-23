import { z } from 'zod';
import { tripSchema } from '../fares/fares.schemas.js';

export const requestRideSchema = tripSchema.extend({
  paymentMethod: z.enum(['CASH', 'WALLET']),
});

export const rideIdParams = z.object({ id: z.uuid('Not a valid ride id') });

export const cancelRideSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export type RequestRideInput = z.infer<typeof requestRideSchema>;
export type CancelRideInput = z.infer<typeof cancelRideSchema>;
