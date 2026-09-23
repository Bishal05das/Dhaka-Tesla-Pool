import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signInAs } from '../helpers/auth.js';
import { resetDatabase } from '../helpers/db.js';
import { stopIds } from '../helpers/stops.js';

const app = createApp();
let stopId: Awaited<ReturnType<typeof stopIds>>;

beforeEach(resetDatabase);
beforeAll(async () => {
  await resetDatabase();
  stopId = await stopIds();
});

const trip = (drop: string, extra: object = {}) => ({
  pickupStopId: stopId('Banani'),
  dropStopId: stopId(drop),
  seats: 1,
  paymentMethod: 'CASH',
  ...extra,
});

describe('requesting a ride', () => {
  it('books Nusrat from Banani to Mohakhali with both prices stored', async () => {
    const nusrat = await signInAs(app, 'nusrat');
    const res = await nusrat.post('/api/rides').send(trip('Mohakhali'));

    expect(res.status).toBe(201);
    expect(res.body.ride).toMatchObject({
      status: 'REQUESTED',
      pickup: { name: 'Banani' },
      drop: { name: 'Mohakhali' },
      seats: 1,
      paymentMethod: 'CASH',
      estimate: { soloPoisha: 9000, pooledPoisha: 7500 },
      fare: null,
      tesla: null,
    });

    const history = await prisma.rideStatusHistory.findMany({ where: { rideRequestId: res.body.ride.id } });
    expect(history).toMatchObject([{ fromStatus: null, toStatus: 'REQUESTED' }]);
  });

  it('accepts TeslaPay when the balance covers the solo fare', async () => {
    const rafiq = await signInAs(app, 'rafiq');
    const res = await rafiq.post('/api/rides').send(trip('Gulshan 1', { paymentMethod: 'WALLET' }));
    expect(res.status).toBe(201);
  });

  it("refuses TeslaPay when the solo fare is more than the balance", async () => {
    // 3 seats to Bashundhara: ৳30 + 10 km × ৳20 × 3 = ৳630, but Shirin has ৳500.
    const shirin = await signInAs(app, 'shirin');
    const res = await shirin.post('/api/rides').send(trip('Bashundhara', { seats: 3, paymentMethod: 'WALLET' }));

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
      details: { balancePoisha: 50000, requiredPoisha: 63000 },
    });
    expect(await prisma.rideRequest.count()).toBe(0);
  });

  it('allows only one active ride per passenger', async () => {
    const nusrat = await signInAs(app, 'nusrat');
    await nusrat.post('/api/rides').send(trip('Mohakhali')).expect(201);

    const second = await nusrat.post('/api/rides').send(trip('Gulshan 1'));
    expect(second.status).toBe(409);
    expect(second.body.error.message).toMatch(/already have an active ride/);
  });

  it('creates exactly one ride when "Request" is double-tapped', async () => {
    const nusrat = await signInAs(app, 'nusrat');
    const results = await Promise.all([
      nusrat.post('/api/rides').send(trip('Mohakhali')),
      nusrat.post('/api/rides').send(trip('Mohakhali')),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.rideRequest.count()).toBe(1);
  });

  it('rejects a trip that is not on the line', async () => {
    const nusrat = await signInAs(app, 'nusrat');
    const res = await nusrat.post('/api/rides').send({ ...trip('Gulshan 1'), pickupStopId: stopId('Mohakhali') });
    expect(res.status).toBe(400);
  });

  it('is for passengers only', async () => {
    const jashim = await signInAs(app, 'jashim');
    expect((await jashim.post('/api/rides').send(trip('Mohakhali'))).status).toBe(403);
  });
});

describe('seeing rides', () => {
  it("shows Nusrat only her own rides, with a timeline", async () => {
    const nusrat = await signInAs(app, 'nusrat');
    const rafiq = await signInAs(app, 'rafiq');
    const { body } = await nusrat.post('/api/rides').send(trip('Mohakhali'));
    await rafiq.post('/api/rides').send(trip('Gulshan 1'));

    const list = await nusrat.get('/api/rides');
    expect(list.body.rides).toHaveLength(1);
    expect(list.body.rides[0].id).toBe(body.ride.id);

    const detail = await nusrat.get(`/api/rides/${body.ride.id}`);
    expect(detail.body.ride.timeline).toMatchObject([{ status: 'REQUESTED', by: 'you' }]);
  });

  it("answers 404 when Rafiq asks for Nusrat's ride", async () => {
    const nusrat = await signInAs(app, 'nusrat');
    const rafiq = await signInAs(app, 'rafiq');
    const { body } = await nusrat.post('/api/rides').send(trip('Mohakhali'));

    const res = await rafiq.get(`/api/rides/${body.ride.id}`);
    expect(res.status).toBe(404);
  });

  it('rejects a malformed ride id with 400', async () => {
    const nusrat = await signInAs(app, 'nusrat');
    expect((await nusrat.get('/api/rides/not-a-uuid')).status).toBe(400);
  });

  it('shows an empty history to a passenger who has never ridden', async () => {
    const shirin = await signInAs(app, 'shirin');
    expect((await shirin.get('/api/rides')).body.rides).toEqual([]);
  });
});
