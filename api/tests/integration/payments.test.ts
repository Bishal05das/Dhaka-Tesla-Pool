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
  await jashim.patch('/api/driver/status').send({ online: true });
});

async function book(who: 'nusrat' | 'rafiq', drop: string, paymentMethod: 'CASH' | 'WALLET') {
  const agent = await signInAs(app, who);
  const res = await agent
    .post('/api/rides')
    .send({ pickupStopId: stopId('Banani'), dropStopId: stopId(drop), seats: 1, paymentMethod });
  expect(res.status).toBe(201);
  await jashim.post(`/api/driver/requests/${res.body.ride.id}/accept`).expect(200);
  return { agent, id: res.body.ride.id as string };
}

async function driveTrip() {
  const poolId = (await jashim.get('/api/driver/pool')).body.pool.id;
  // Bare POSTs with no body, the way a simple client would send them.
  for (const step of ['arrive', 'start']) await jashim.post(`/api/pools/${poolId}/${step}`).expect(200);
  return { poolId, complete: () => jashim.post(`/api/pools/${poolId}/complete`) };
}

describe('paying at the end of the trip', () => {
  it('debits Nusrat ৳75 from TeslaPay and records Rafiq paying ৳105 cash', async () => {
    const nusrat = await book('nusrat', 'Mohakhali', 'WALLET');
    const rafiq = await book('rafiq', 'Gulshan 1', 'CASH');
    const trip = await driveTrip();

    // Nothing is charged at the start, only fixed.
    expect((await nusrat.agent.get('/api/wallet')).body.balancePoisha).toBe(50000);

    const done = await trip.complete();
    expect(done.status).toBe(200);

    const wallet = (await nusrat.agent.get('/api/wallet')).body;
    expect(wallet.balancePoisha).toBe(42500);
    expect(wallet.transactions).toMatchObject([
      { type: 'RIDE_PAYMENT', amountPoisha: -7500, balanceAfterPoisha: 42500, rideRequestId: nusrat.id },
    ]);
    expect((await nusrat.agent.get(`/api/rides/${nusrat.id}`)).body.ride.payment).toMatchObject({
      method: 'WALLET',
      amountPoisha: 7500,
    });

    // Rafiq's wallet is untouched; Jashim sees he has cash to collect.
    expect((await rafiq.agent.get('/api/wallet')).body.balancePoisha).toBe(50000);
    const [history] = (await jashim.get('/api/driver/history')).body.trips;
    expect(history.passengers.map((p: { name: string; paidBy: string }) => [p.name, p.paidBy])).toEqual([
      ['Nusrat', 'WALLET'],
      ['Rafiq', 'CASH'],
    ]);
  });

  it('charges nobody for a trip the driver cancelled', async () => {
    const nusrat = await book('nusrat', 'Mohakhali', 'WALLET');
    const poolId = (await jashim.get('/api/driver/pool')).body.pool.id;
    await jashim.post(`/api/pools/${poolId}/cancel`).send({}).expect(200);

    expect((await nusrat.agent.get('/api/wallet')).body.balancePoisha).toBe(50000);
    expect(await prisma.payment.count()).toBe(0);
  });

  it('records one payment per ride, even if "complete" is sent twice', async () => {
    const nusrat = await book('nusrat', 'Mohakhali', 'WALLET');
    const trip = await driveTrip();

    const results = await Promise.all([trip.complete(), trip.complete()]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.payment.count()).toBe(1);
    // Charged once, at the solo fare (she rode alone): ৳500 − ৳90.
    expect((await nusrat.agent.get('/api/wallet')).body.balancePoisha).toBe(41000);
  });

  it('falls back to cash rather than overdrawing the wallet', async () => {
    const nusrat = await book('nusrat', 'Mohakhali', 'WALLET');
    const trip = await driveTrip();
    // Simulate a balance that can no longer cover the fare (can't happen through the API).
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'nusrat@dhakatesla.test' } });
    await prisma.wallet.update({ where: { userId: user.id }, data: { balancePoisha: 1000 } });

    await trip.complete().expect(200);

    expect((await nusrat.agent.get('/api/wallet')).body.balancePoisha).toBe(1000);
    expect((await nusrat.agent.get(`/api/rides/${nusrat.id}`)).body.ride.payment.method).toBe('CASH');
  });
});
