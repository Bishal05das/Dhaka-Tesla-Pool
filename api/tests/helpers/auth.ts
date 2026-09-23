import type { Express } from 'express';
import request from 'supertest';
import { CAST, DEMO_PASSWORD } from '../../prisma/seed-data.js';

// A supertest agent keeps cookies between requests, like a browser tab signed in as that person.
export async function signInAs(app: Express, who: keyof typeof CAST) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: CAST[who].email, password: DEMO_PASSWORD });
  if (res.status !== 200) throw new Error(`Sign-in as ${who} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}
