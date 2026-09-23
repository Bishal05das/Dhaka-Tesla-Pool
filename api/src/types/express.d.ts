import type { AuthUser } from '../lib/session.js';

declare global {
  namespace Express {
    interface Locals {
      // Set by requireAuth; read it only on routes behind requireAuth.
      user: AuthUser;
      // Set by validate(); typed at the point of use.
      validated: Record<string, unknown>;
    }
  }
}

export {};
