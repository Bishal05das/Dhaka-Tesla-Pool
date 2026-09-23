import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { authRateLimit } from '../../src/middleware/rateLimit.js';

describe('authRateLimit', () => {
  it('lets the first attempts through, then answers 429 in the standard error shape', async () => {
    const app = express();
    app.post('/login', authRateLimit(3), (_req, res) => {
      res.status(401).json({});
    });
    app.use(errorHandler);

    for (let i = 0; i < 3; i++) {
      expect((await request(app).post('/login')).status).toBe(401);
    }
    const blocked = await request(app).post('/login');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['ratelimit-policy']).toBeDefined();
  });
});
