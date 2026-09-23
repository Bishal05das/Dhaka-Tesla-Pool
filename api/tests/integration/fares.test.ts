import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { signInAs } from '../helpers/auth.js';
import { resetDatabase } from '../helpers/db.js';
import { stopIds } from '../helpers/stops.js';

const app = createApp();
let stopId: Awaited<ReturnType<typeof stopIds>>;

beforeAll(async () => {
  await resetDatabase();
  stopId = await stopIds();
});

describe('POST /api/fares/estimate', () => {
  it('quotes Nusrat ৳90 alone or ৳75 pooled to Mohakhali', async () => {
    const nusrat = await signInAs(app, 'nusrat');
    const res = await nusrat
      .post('/api/fares/estimate')
      .send({ pickupStopId: stopId('Banani'), dropStopId: stopId('Mohakhali'), seats: 1 });

    expect(res.status).toBe(200);
    expect(res.body.trip).toMatchObject({
      pickup: { name: 'Banani' },
      drop: { name: 'Mohakhali' },
      distanceM: 3000,
      seats: 1,
    });
    expect(res.body.estimate.solo.totalPoisha).toBe(9000);
    expect(res.body.estimate.pooled).toMatchObject({ poolDiscountPoisha: 1500, totalPoisha: 7500 });
  });

  it('quotes Rafiq ৳130 alone or ৳105 pooled to Gulshan 1', async () => {
    const rafiq = await signInAs(app, 'rafiq');
    const res = await rafiq
      .post('/api/fares/estimate')
      .send({ pickupStopId: stopId('Banani'), dropStopId: stopId('Gulshan 1'), seats: 1 });

    expect(res.body.estimate.solo.totalPoisha).toBe(13000);
    expect(res.body.estimate.pooled.totalPoisha).toBe(10500);
  });

  it('rejects a trip that goes backwards along the line', async () => {
    const shirin = await signInAs(app, 'shirin');
    const res = await shirin
      .post('/api/fares/estimate')
      .send({ pickupStopId: stopId('Gulshan 2'), dropStopId: stopId('Banani'), seats: 1 });
    expect(res.status).toBe(400);
  });

  it('rejects 4 seats', async () => {
    const shirin = await signInAs(app, 'shirin');
    const res = await shirin
      .post('/api/fares/estimate')
      .send({ pickupStopId: stopId('Banani'), dropStopId: stopId('Gulshan 2'), seats: 4 });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('seats');
  });

  it('is for passengers only', async () => {
    const jashim = await signInAs(app, 'jashim');
    const res = await jashim
      .post('/api/fares/estimate')
      .send({ pickupStopId: stopId('Banani'), dropStopId: stopId('Mohakhali'), seats: 1 });
    expect(res.status).toBe(403);

    expect((await request(app).post('/api/fares/estimate').send({})).status).toBe(401);
  });
});
