import { z } from 'zod';

const email = z.string().trim().toLowerCase().max(254).pipe(z.email({ error: 'Enter a valid email' }));
// bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated.
const password = z.string().min(8, 'Use at least 8 characters').max(72);
const name = z.string().trim().min(1, 'Name is required').max(80);

export const registerSchema = z.object({
  role: z.literal('PASSENGER'),
  name,
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
