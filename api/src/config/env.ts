import { z } from 'zod';

// Local development reads api/.env. Variables already set (Docker, Render) are never overridden.
if (process.env.NODE_ENV !== 'production') {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file — fine
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // HS256 signing key for session tokens. 32+ chars so it can't be brute-forced.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_TTL_HOURS: z.coerce.number().int().positive().default(12),
  // Secure cookies need HTTPS. Defaults to on in production; docker compose on plain http sets it false.
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  // Proxy hops in front of the API whose X-Forwarded-For entries we trust, so req.ip (used by
  // the login rate limit) is the visitor, not a proxy.
  //   Vercel -> Render: 2. Vercel's edge overwrites X-Forwarded-For with the visitor's address
  //     (so it can't be faked) and Render's load balancer appends Vercel's.
  //   docker compose: 0. Self-hosted Next.js forwards /api without adding the visitor's address,
  //     so any X-Forwarded-For would come from the client itself and must not be trusted.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  // How long a ride request waits for a driver before it expires, and how often we check.
  REQUEST_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(300),
  EXPIRY_SWEEP_SECONDS: z.coerce.number().int().positive().default(15),
  // Sign-up + login attempts allowed per IP per 15 minutes.
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Comma-separated list of browser origins allowed to call the API directly.
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Fail fast at boot rather than on the first request that needs a missing value.
    console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors);
    process.exit(1);
  }
  return {
    ...parsed.data,
    COOKIE_SECURE: parsed.data.COOKIE_SECURE ?? parsed.data.NODE_ENV === 'production',
  };
}

export const env = loadEnv();
export type Env = typeof env;
