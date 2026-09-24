// The one place the browser calls the API. Requests go to this app's own /api/*, which
// next.config.ts forwards to Express, so the httpOnly session cookie travels automatically.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  // Zod field errors from a 400, e.g. { email: ['Enter a valid email'] }.
  fieldErrors(): Record<string, string[]> {
    return this.code === 'VALIDATION_ERROR' && this.details && typeof this.details === 'object'
      ? (this.details as Record<string, string[]>)
      : {};
  }
}

type Method = 'GET' | 'POST' | 'PATCH';

export async function api<T>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  const { method = 'GET', body } = options;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'NETWORK', "Can't reach Dhaka Tesla Pool. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? `Something went wrong (HTTP ${res.status})`,
      err?.details,
    );
  }
  return data as T;
}
