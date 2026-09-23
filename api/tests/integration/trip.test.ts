import { randomUUID } from 'node:crypto';
import type TestAgent from 'supertest/lib/agent.js';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signInAs } from '../helpers/auth.js';
import { resetDatabase } from '../helpers/db.js';
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
  jashim = await signInAs(app, 'jashim');
  await jashim.patch('/api/driver/status').send({ online: true }).expect(200);
});

async function book(who: 'nusrat' | 'rafiq' | 'shirin', drop: string, seats = 1) {
  const agent = await signInAs(app, who);
  const res = await agent
    .post('/api/rides')
    .send({ pickupStopId: stopId('Banani'), dropStopId: stopId(drop), seats, paymentMethod: 'CASH' });
  return { agent, id: res.body.ride.id as string };
}

// Nusrat and Rafiq both accepted into Bullet; returns the trip id.
async function nusratAndRafiqInBullet() {
  const nusrat = await book('nusrat', 'Mohakhali');
  const rafiq = await book('rafiq', 'Gulshan 1');
  const poolId = (await jashim.post(`/api/driver/requests/${nusrat.id}/accept`)).body.pool.id as string;
  await jashim.post(`/api/driver/requests/${rafiq.id}/accept`).expect(200);
  return { nusrat, rafiq, poolId };
}

const act = (poolId: string, action: string, body: object = {}) =>
  jashim.post(`/api/pools/${poolId}/${action}`).send(body);

describe('the full trip', () => {
  it('takes Nusrat and Rafiq from Banani and charges each their pooled fare', async () => {
    const { nusrat, rafiq, poolId } = await nusratAndRafiqInBullet();

    expect((await act(poolId, 'arrive')).body.pool.status).toBe('DRIVER_ARRIVED');
    expect((await nusrat.agent.get(`/api/rides/${nusrat.id}`)).body.ride.status).toBe('DRIVER_ARRIVED');

    const started = await act(poolId, 'start');
    expect(started.body.pool.status).toBe('STARTED');

    // Frozen at the start: both were aboard, so both get the pooled fare.
    const nusratRide = (await nusrat.agent.get(`/api/rides/${nusrat.id}`)).body.ride;
    expect(nusratRide.fare).toEqual({
      basePoisha: 3000,
      distanceChargePoisha: 6000,
      poolDiscountPoisha: 1500,
      totalPoisha: 7500,
      pooled: true,
    });
    expect((await rafiq.agent.get(`/api/rides/${rafiq.id}`)).body.ride.fare.totalPoisha).toBe(10500);

    await act(poolId, 'complete').expect(200);

    const finished = (await nusrat.agent.get(`/api/rides/${nusrat.id}`)).body.ride;
    expect(finished.status).toBe('COMPLETED');
    expect(finished.timeline.map((t: { status: string }) => t.status)).toEqual([
      'REQUESTED',
      'MATCHED',
      'DRIVER_ARRIVED',
      'STARTED',
      'COMPLETED',
    ]);

    // Jashim is free for the next trip, and his history shows what he earned.
    expect((await jashim.get('/api/driver/pool')).body.pool).toBeNull();
    const [trip] = (await jashim.get('/api/driver/history')).body.trips;
    expect(trip).toMatchObject({ status: 'COMPLETED', earnedPoisha: 18000 });
    expect(trip.passengers.map((p: { name: string; farePoisha: number }) => [p.name, p.farePoisha])).toEqual([
      ['Nusrat', 7500],
      ['Rafiq', 10500],
    ]);
  });

  it('charges Nusrat the solo fare if Rafiq cancels before the start', async () => {
    const { nusrat, rafiq, poolId } = await nusratAndRafiqInBullet();
    await act(poolId, 'arrive');
    await rafiq.agent.post(`/api/rides/${rafiq.id}/cancel`).send({}).expect(200);

    await act(poolId, 'start');

    const fare = (await nusrat.agent.get(`/api/rides/${nusrat.id}`)).body.ride.fare;
    expect(fare).toMatchObject({ pooled: false, poolDiscountPoisha: 0, totalPoisha: 9000 });
  });

  it('keeps the pooled fare for passengers already riding when the trip ends', async () => {
    const { nusrat, poolId } = await nusratAndRafiqInBullet();
    await act(poolId, 'arrive');
    await act(poolId, 'start');
    await act(poolId, 'complete');
    const ride = await prisma.rideRequest.findUniqueOrThrow({ where: { id: nusrat.id } });
    expect(ride).toMatchObject({ pooled: true, finalFarePoisha: 7500 });
  });
});

describe('invalid steps are rejected', () => {
  it.each([
    ['start before arriving', [], 'start'],
    ['complete before starting', ['arrive'], 'complete'],
    ['arrive twice', ['arrive'], 'arrive'],
    ['cancel once moving', ['arrive', 'start'], 'cancel'],
    ['do anything after completing', ['arrive', 'start', 'complete'], 'arrive'],
  ])('%s', async (_name, before, action) => {
    const { poolId } = await nusratAndRafiqInBullet();
    for (const step of before) await act(poolId, step).expect(200);

    const statusBefore = (await prisma.pool.findUniqueOrThrow({ where: { id: poolId } })).status;
    const res = await act(poolId, action);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    // Nothing changed: not the pool, and not any passenger's ride.
    expect((await prisma.pool.findUniqueOrThrow({ where: { id: poolId } })).status).toBe(statusBefore);
    const rides = await prisma.rideRequest.findMany();
    expect(new Set(rides.map((r) => r.status))).toEqual(new Set([statusBefore]));
  });

  it("answers 404 for a trip that isn't Jashim's", async () => {
    expect((await act(randomUUID(), 'arrive')).status).toBe(404);
  });

  it("won't let a passenger drive the trip", async () => {
    const { nusrat, poolId } = await nusratAndRafiqInBullet();
    expect((await nusrat.agent.post(`/api/pools/${poolId}/start`).send()).status).toBe(403);
  });
});

describe('driver cancels', () => {
  it('cancels every passenger with the reason, and they can book again', async () => {
    const { nusrat, rafiq, poolId } = await nusratAndRafiqInBullet();

    const res = await act(poolId, 'cancel', { reason: 'Flat tyre on Road 11' });
    expect(res.body.pool.status).toBe('CANCELLED');

    for (const p of [nusrat, rafiq]) {
      const ride = (await p.agent.get(`/api/rides/${p.id}`)).body.ride;
      expect(ride).toMatchObject({ status: 'CANCELLED', cancelReason: 'Flat tyre on Road 11' });
      expect(ride.timeline.at(-1)).toMatchObject({ status: 'CANCELLED', by: 'driver' });
    }
    await book('nusrat', 'Mohakhali');
    expect(await prisma.rideRequest.count({ where: { status: 'REQUESTED' } })).toBe(1);

    // And Jashim can go offline now that Bullet is empty.
    await jashim.patch('/api/driver/status').send({ online: false }).expect(200);
  });
});
