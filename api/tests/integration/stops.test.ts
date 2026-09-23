import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { signInAs } from '../helpers/auth.js';
import { resetDatabase } from '../helpers/db.js';

const app = createApp();

beforeAll(resetDatabase);

describe('GET /api/stops', () => {
  it('returns the line in travel order', async () => {
    const agent = await signInAs(app, 'shirin');
    const res = await agent.get('/api/stops');

    expect(res.status).toBe(200);
    expect(res.body.stops.map((s: { name: string }) => s.name)).toEqual([
      'Banani',
      'Mohakhali',
      'Gulshan 1',
      'Gulshan 2',
      'Bashundhara',
    ]);
    expect(res.body.stops[0]).toMatchObject({ sequence: 0, distanceFromStartM: 0, lat: 23.7937 });
  });

  it('requires a signed-in user', async () => {
    expect((await request(app).get('/api/stops')).status).toBe(401);
  });
});
