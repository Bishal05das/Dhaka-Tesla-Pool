import type { Express } from 'express';
import type TestAgent from 'supertest/lib/agent.js';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signInAs } from '../helpers/auth.js';
import { resetDatabase } from '../helpers/db.js';
import { stopIds } from '../helpers/stops.js';

const app: Express = createApp();
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

async function requestRide(who: 'nusrat' | 'rafiq' | 'shirin', drop: string, seats = 1) {
  const agent = await signInAs(app, who);
  const res = await agent
    .post('/api/rides')
    .send({ pickupStopId: stopId('Banani'), dropStopId: stopId(drop), seats, paymentMethod: 'CASH' });
  expect(res.status).toBe(201);
  return { agent, id: res.body.ride.id as string };
}

const accept = (rideId: string) => jashim.post(`/api/driver/requests/${rideId}/accept`).send();

// The invariant every test below protects: the seat counter always equals the seats of the
// passengers actually in the pool, and never exceeds the Tesla's capacity.
async function expectConsistentPools() {
  const pools = await prisma.pool.findMany({ include: { members: { where: { leftAt: null } } } });
  for (const pool of pools) {
    expect(pool.seatsOccupied).toBe(pool.members.reduce((sum, m) => sum + m.seats, 0));
    expect(pool.seatsOccupied).toBeLessThanOrEqual(pool.capacity);
  }
  return pools;
}

describe('the 8:41 AM Banani story', () => {
  it('puts Nusrat and Rafiq in the same Tesla', async () => {
    const nusrat = await requestRide('nusrat', 'Mohakhali');
    const rafiq = await requestRide('rafiq', 'Gulshan 1');

    const first = await accept(nusrat.id);
    expect(first.status).toBe(200);
    expect(first.body.pool).toMatchObject({ status: 'MATCHED', seatsOccupied: 1, seatsFree: 2 });

    const second = await accept(rafiq.id);
    expect(second.body.pool.id).toBe(first.body.pool.id);
    expect(second.body.pool).toMatchObject({ seatsOccupied: 2, seatsFree: 1 });
    expect(second.body.pool.passengers.map((p: { name: string }) => p.name)).toEqual(['Nusrat', 'Rafiq']);

    // Nusrat sees who is coming and that she's sharing, but not with whom.
    const ride = (await nusrat.agent.get(`/api/rides/${nusrat.id}`)).body.ride;
    expect(ride).toMatchObject({
      status: 'MATCHED',
      tesla: { driverName: 'Jashim', vehicleName: 'Bullet', coRiders: 1 },
    });
    expect(JSON.stringify(ride)).not.toContain('Rafiq');
    expect(ride.timeline.map((t: { status: string; by: string }) => [t.status, t.by])).toEqual([
      ['REQUESTED', 'you'],
      ['MATCHED', 'driver'],
    ]);

    await expectConsistentPools();
  });

  it("turns Shirin away when Bullet's 3 seats are taken", async () => {
    const rafiq = await requestRide('rafiq', 'Gulshan 1', 2);
    const nusrat = await requestRide('nusrat', 'Mohakhali');
    const shirin = await requestRide('shirin', 'Gulshan 2');
    await accept(rafiq.id).expect(200);
    await accept(nusrat.id).expect(200);

    const res = await accept(shirin.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAPACITY_EXCEEDED');
    expect((await prisma.rideRequest.findUniqueOrThrow({ where: { id: shirin.id } })).status).toBe('REQUESTED');
    await expectConsistentPools();
  });

  it('seats a late joiner straight into an arrived Tesla', async () => {
    const nusrat = await requestRide('nusrat', 'Mohakhali');
    const { body } = await accept(nusrat.id);
    await prisma.pool.update({ where: { id: body.pool.id }, data: { status: 'DRIVER_ARRIVED' } });

    const rafiq = await requestRide('rafiq', 'Gulshan 1');
    await accept(rafiq.id).expect(200);

    const ride = (await rafiq.agent.get(`/api/rides/${rafiq.id}`)).body.ride;
    expect(ride.status).toBe('DRIVER_ARRIVED');
    expect(ride.timeline.map((t: { status: string }) => t.status)).toEqual(['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED']);
  });
});

describe('when accepting is refused', () => {
  it('while Jashim is offline', async () => {
    const nusrat = await requestRide('nusrat', 'Mohakhali');
    await jashim.patch('/api/driver/status').send({ online: false });
    expect((await accept(nusrat.id)).status).toBe(409);
  });

  it('for a ride that is already in the pool', async () => {
    const nusrat = await requestRide('nusrat', 'Mohakhali');
    await accept(nusrat.id).expect(200);
    expect((await accept(nusrat.id)).status).toBe(409);
    await expectConsistentPools();
  });

  it('for a ride the passenger cancelled', async () => {
    const nusrat = await requestRide('nusrat', 'Mohakhali');
    await nusrat.agent.post(`/api/rides/${nusrat.id}/cancel`).send({}).expect(200);
    expect((await accept(nusrat.id)).status).toBe(409);
    expect(await prisma.pool.count()).toBe(0);
  });

  it('once the trip has started', async () => {
    const nusrat = await requestRide('nusrat', 'Mohakhali');
    const rafiq = await requestRide('rafiq', 'Gulshan 1');
    const { body } = await accept(nusrat.id);
    await prisma.pool.update({ where: { id: body.pool.id }, data: { status: 'STARTED' } });

    const res = await accept(rafiq.id);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/already started/);
  });

  it('for passengers, who cannot accept rides at all', async () => {
    const nusrat = await requestRide('nusrat', 'Mohakhali');
    const rafiq = await signInAs(app, 'rafiq');
    expect((await rafiq.post(`/api/driver/requests/${nusrat.id}/accept`).send()).status).toBe(403);
  });
});

describe('concurrency', () => {
  it('gives the last seat to exactly one of Nusrat and Shirin', async () => {
    const rafiq = await requestRide('rafiq', 'Gulshan 1', 2);
    await accept(rafiq.id).expect(200);
    const nusrat = await requestRide('nusrat', 'Mohakhali');
    const shirin = await requestRide('shirin', 'Gulshan 2');

    // Both see 1 seat free, and both accepts are fired at the same instant.
    const results = await Promise.all([accept(nusrat.id), accept(shirin.id)]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)?.body.error.code).toBe('CAPACITY_EXCEEDED');
    const [pool] = await expectConsistentPools();
    expect(pool?.seatsOccupied).toBe(3);
    const statuses = await prisma.rideRequest.findMany({ where: { id: { in: [nusrat.id, shirin.id] } } });
    expect(statuses.map((r) => r.status).sort()).toEqual(['MATCHED', 'REQUESTED']);
  });

  it('creates one pool, not three, when three first accepts race', async () => {
    // Each wants 2 of Bullet's 3 seats, so only one can fit.
    const rides = await Promise.all([
      requestRide('nusrat', 'Mohakhali', 2),
      requestRide('rafiq', 'Gulshan 1', 2),
      requestRide('shirin', 'Gulshan 2', 2),
    ]);

    const results = await Promise.all(rides.map((r) => accept(r.id)));

    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    const pools = await expectConsistentPools();
    expect(pools).toHaveLength(1);
    expect(pools[0]?.seatsOccupied).toBe(2);
  });

  it('stays consistent when Nusrat cancels just as Jashim accepts her', async () => {
    for (let round = 0; round < 5; round++) {
      await resetDatabase();
      jashim = await signInAs(app, 'jashim');
      await jashim.patch('/api/driver/status').send({ online: true });
      const nusrat = await requestRide('nusrat', 'Mohakhali');

      const [accepted, cancelled] = await Promise.all([
        accept(nusrat.id),
        nusrat.agent.post(`/api/rides/${nusrat.id}/cancel`).send({}),
      ]);

      // Whichever order the database ran them in, her ride ends up cancelled
      // and no seat is left held for her.
      expect(cancelled.status).toBe(200);
      expect([200, 409]).toContain(accepted.status);
      const ride = await prisma.rideRequest.findUniqueOrThrow({ where: { id: nusrat.id } });
      expect(ride.status).toBe('CANCELLED');
      const pools = await expectConsistentPools();
      for (const pool of pools) expect(pool.seatsOccupied).toBe(0);
    }
  });
});

describe('database guards, independent of the application code', () => {
  it('refuses to store more occupied seats than Bullet has', async () => {
    const nusrat = await requestRide('nusrat', 'Mohakhali');
    const { body } = await accept(nusrat.id);
    await expect(
      prisma.$executeRaw`UPDATE pools SET seats_occupied = 4 WHERE id = ${body.pool.id}::uuid`,
    ).rejects.toThrow(/pools_seats_chk/);
  });

  it('refuses a second active pool for Bullet', async () => {
    const nusrat = await requestRide('nusrat', 'Mohakhali');
    const { body } = await accept(nusrat.id);
    const pool = await prisma.pool.findUniqueOrThrow({ where: { id: body.pool.id } });
    await expect(
      prisma.pool.create({ data: { vehicleId: pool.vehicleId, capacity: 3, status: 'MATCHED' } }),
    ).rejects.toThrow();
  });
});
