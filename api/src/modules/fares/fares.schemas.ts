import { z } from 'zod';

// Shared with ride requests: the same trip + seats that gets quoted gets booked.
export const tripSchema = z.object({
  pickupStopId: z.coerce.number().int().positive(),
  dropStopId: z.coerce.number().int().positive(),
  seats: z.coerce.number().int().min(1, 'At least 1 seat').max(3, 'At most 3 seats'),
});

export type TripInput = z.infer<typeof tripSchema>;
