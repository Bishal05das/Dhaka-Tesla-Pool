import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { signInAs } from '../helpers/auth.js';
import { resetDatabase } from '../helpers/db.js';
import { bulletOnline, putInBulletsPool } from '../helpers/pools.js';
import { stopIds } from '../helpers/stops.js';

const app = createApp();
let stopId: Awaited<ReturnType<typeof stopIds>>;

beforeAll(async () => {
  await resetDatabase();
  stopId = await stopIds();
});
beforeEach(async () => {
  await resetDatabase();
  await bulletOnline();
});

async function requestRide(who: 'nusrat' | 'rafiq' | 'shirin', drop: string, seats = 1) {
  const agent = await signInAs(app, who);
  const res = await agent
    .post('/api/rides')
    .send({ pickupStopId: stopId('Banani'), dropStopId: stopId(drop), seats, paymentMethod: 'CASH' });
  return res.body.ride.id as string;
}

describe('going online and offline', () => {
  it('lets Jashim go online and back offline', async () => {
    const jashim = await signInAs(app, 'jashim');
    expect((await jashim.patch('/api/driver/status').send({ online: true })).body).toEqual({ isOnline: true });
    expect((await jashim.patch('/api/driver/status').send({ online: false })).body).toEqual({ isOnline: false });
  });

  it("won't let him go offline with passengers in Bullet", async () => {
    const jashim = await signInAs(app, 'jashim');
    await jashim.patch('/api/driver/status').send({ online: true });
    await putInBulletsPool([await requestRide('nusrat', 'Mohakhali')]);

    const res = await jashim.patch('/api/driver/status').send({ online: false });
    expect(res.status).toBe(409);
  });

  it('is for drivers only', async () => {
    const nusrat = await signInAs(app, 'nusrat');
    expect((await nusrat.patch('/api/driver/status').send({ online: true })).status).toBe(403);
    expect((await nusrat.get('/api/driver/requests')).status).toBe(403);
  });
});

describe('open requests', () => {
  it('lists waiting passengers oldest first with their drop-off and fare', async () => {
    await requestRide('nusrat', 'Mohakhali');
    await requestRide('rafiq', 'Gulshan 1');

    const jashim = await signInAs(app, 'jashim');
    const res = await jashim.get('/api/driver/requests');

    expect(res.body.seatsFree).toBe(3);
    expect(res.body.requests).toMatchObject([
      { passengerName: 'Nusrat', drop: { name: 'Mohakhali' }, seats: 1, estimate: { soloPoisha: 9000 } },
      { passengerName: 'Rafiq', drop: { name: 'Gulshan 1' }, seats: 1 },
    ]);
  });

  it('hides requests that need more seats than Bullet has left', async () => {
    // All three booked while Bullet was empty; then Rafiq takes 2 of its 3 seats,
    // so only 1-seat requests still fit.
    const rafiq = await requestRide('rafiq', 'Gulshan 1', 2);
    await requestRide('nusrat', 'Mohakhali', 1);
    await requestRide('shirin', 'Gulshan 2', 2);
    await putInBulletsPool([rafiq]);

    const jashim = await signInAs(app, 'jashim');
    const res = await jashim.get('/api/driver/requests');

    expect(res.body.seatsFree).toBe(1);
    expect(res.body.requests.map((r: { passengerName: string }) => r.passengerName)).toEqual(['Nusrat']);
  });

  it('shows nothing once the trip has started', async () => {
    const rafiq = await requestRide('rafiq', 'Gulshan 1');
    await requestRide('nusrat', 'Mohakhali');
    await putInBulletsPool([rafiq], 'STARTED');

    const jashim = await signInAs(app, 'jashim');
    expect((await jashim.get('/api/driver/requests')).body).toMatchObject({ seatsFree: 0, requests: [] });
  });

  it('shows an empty list when nobody is waiting', async () => {
    const jashim = await signInAs(app, 'jashim');
    expect((await jashim.get('/api/driver/requests')).body.requests).toEqual([]);
  });
});

describe('current pool', () => {
  it('is empty before any passenger is accepted', async () => {
    const jashim = await signInAs(app, 'jashim');
    expect((await jashim.get('/api/driver/pool')).body).toEqual({ pool: null });
  });

  it('lists passengers in drop-off order with seats used', async () => {
    const rafiq = await requestRide('rafiq', 'Gulshan 1');
    const nusrat = await requestRide('nusrat', 'Mohakhali');
    await putInBulletsPool([rafiq, nusrat]);

    const jashim = await signInAs(app, 'jashim');
    const { pool } = (await jashim.get('/api/driver/pool')).body;

    expect(pool).toMatchObject({ status: 'MATCHED', capacity: 3, seatsOccupied: 2, seatsFree: 1 });
    expect(pool.passengers.map((p: { name: string; drop: { name: string } }) => [p.name, p.drop.name])).toEqual([
      ['Nusrat', 'Mohakhali'],
      ['Rafiq', 'Gulshan 1'],
    ]);
  });
});
