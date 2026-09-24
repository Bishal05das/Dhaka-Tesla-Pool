import type TestAgent from 'supertest/lib/agent.js';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { expireStaleRequests } from '../../src/modules/rides/expiry.service.js';
import { signInAs } from '../helpers/auth.js';
import { resetDatabase } from '../helpers/db.js';
import { bulletOnline } from '../helpers/pools.js';
import { stopIds } from '../helpers/stops.js';

const app = createApp();
let stopId: Awaited<ReturnType<typeof stopIds>>;
let jashim: TestAgent;

beforeAll(async () => {
  await resetDatabase();
  stopId = await stopIds();
});
beforeEach(async () => {
  await resetDatabase();
  await bulletOnline();
  jashim = await signInAs(app, 'jashim');
});

async function book(who: 'nusrat' | 'rafiq') {
  const agent = await signInAs(app, who);
  const res = await agent
    .post('/api/rides')
    .send({ pickupStopId: stopId('Banani'), dropStopId: stopId('Mohakhali'), seats: 1, paymentMethod: 'CASH' });
  expect(res.status).toBe(201);
  return { agent, ride: res.body.ride as { id: string; createdAt: string; expiresAt: string } };
}

// Pretend the request was made `minutes` ago.
const age = (rideId: string, minutes: number) =>
  prisma.rideRequest.update({
    where: { id: rideId },
    data: { createdAt: new Date(Date.now() - minutes * 60_000) },
  });

describe('waiting has a limit', () => {
  it('tells Nusrat when her request will give up: 5 minutes after she made it', async () => {
    const { ride } = await book('nusrat');
    expect(new Date(ride.expiresAt).getTime() - new Date(ride.createdAt).getTime()).toBe(5 * 60_000);
  });

  it('expires a request nobody accepted in 5 minutes, and says why', async () => {
    const { agent, ride } = await book('nusrat');
    await age(ride.id, 6);

    expect(await expireStaleRequests()).toEqual([ride.id]);

    const detail = (await agent.get(`/api/rides/${ride.id}`)).body.ride;
    expect(detail).toMatchObject({ status: 'EXPIRED', expiresAt: null, cancelReason: expect.stringMatching(/in time/) });
    expect(detail.timeline.at(-1)).toMatchObject({ status: 'EXPIRED', by: 'system' });

    // And she can book again straight away.
    await book('nusrat');
  });

  it('leaves a fresh request alone', async () => {
    const { ride } = await book('nusrat');
    await age(ride.id, 4);
    expect(await expireStaleRequests()).toEqual([]);
  });

  it('never expires a ride a driver already accepted, however old', async () => {
    const { ride } = await book('nusrat');
    await jashim.post(`/api/driver/requests/${ride.id}/accept`).expect(200);
    await age(ride.id, 30);

    expect(await expireStaleRequests()).toEqual([]);
    expect((await prisma.rideRequest.findUniqueOrThrow({ where: { id: ride.id } })).status).toBe('MATCHED');
  });

  it('expires each request once even if two sweeps run at the same time', async () => {
    const { ride } = await book('nusrat');
    await age(ride.id, 6);

    const [a, b] = await Promise.all([expireStaleRequests(), expireStaleRequests()]);

    expect([...a, ...b]).toEqual([ride.id]);
    expect(await prisma.rideStatusHistory.count({ where: { rideRequestId: ride.id, toStatus: 'EXPIRED' } })).toBe(1);
  });
});

describe('the driver never sees or takes an overdue request', () => {
  it('hides it from the waiting list even before the sweep runs', async () => {
    const { ride } = await book('nusrat');
    await book('rafiq');
    await age(ride.id, 6);

    const names = (await jashim.get('/api/driver/requests')).body.requests.map((r: { passengerName: string }) => r.passengerName);
    expect(names).toEqual(['Rafiq']);
  });

  it('refuses to accept it, and creates no trip', async () => {
    const { ride } = await book('nusrat');
    await age(ride.id, 6);

    const res = await jashim.post(`/api/driver/requests/${ride.id}/accept`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/expired/);
    expect(await prisma.pool.count()).toBe(0);
  });
});
