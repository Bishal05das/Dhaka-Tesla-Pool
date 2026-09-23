import { z } from 'zod';

const email = z.string().trim().toLowerCase().max(254).pipe(z.email({ error: 'Enter a valid email' }));
// bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated.
const password = z.string().min(8, 'Use at least 8 characters').max(72);
const name = z.string().trim().min(1, 'Name is required').max(80);

const vehicle = z.object({
  name: z.string().trim().min(1, 'Give your Tesla a name').max(40),
  // Stored upper-case so "dhaka-tesla-11" and "DHAKA-TESLA-11" count as the same plate.
  plate: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9 -]{1,18}[A-Z0-9]$/, 'Use 3-20 letters, digits, spaces or hyphens'),
  // Fixed at sign-up: there is no endpoint to change it later.
  capacity: z.coerce.number().int().min(1).max(3, 'A Tesla has at most 3 seats'),
});

export const registerSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('PASSENGER'), name, email, password }),
  z.object({ role: z.literal('DRIVER'), name, email, password, vehicle }),
]);

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
