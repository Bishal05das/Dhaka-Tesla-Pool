import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signInAs } from '../helpers/auth.js';
import { resetDatabase } from '../helpers/db.js';
import { bulletOnline, putInBulletsPool } from '../helpers/pools.js';
import { stopIds } from '../helpers/stops.js';

const app = createApp();
let stopId: Awaited<ReturnType<typeof stopIds>>;

beforeEach(async () => {
  await resetDatabase();
  await bulletOnline();
});
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

describe("refusing a request no Tesla can take, instead of letting it wait", () => {
  it('when no Tesla is online', async () => {
    await bulletOnline(false);
    const shirin = await signInAs(app, 'shirin');
    const res = await shirin.post('/api/rides').send(trip('Gulshan 2'));

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'NO_TESLA_AVAILABLE', message: expect.stringMatching(/online/) });
    expect(await prisma.rideRequest.count({ where: { status: 'REQUESTED' } })).toBe(0);
  });

  it("when Bullet's 3 seats are all taken", async () => {
    const nusrat = await signInAs(app, 'nusrat');
    const rafiq = await signInAs(app, 'rafiq');
    const n = (await nusrat.post('/api/rides').send(trip('Mohakhali'))).body.ride;
    const r = (await rafiq.post('/api/rides').send(trip('Gulshan 1', { seats: 2 }))).body.ride;
    await putInBulletsPool([n.id, r.id]);

    const shirin = await signInAs(app, 'shirin');
    const res = await shirin.post('/api/rides').send(trip('Gulshan 2'));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/full/);
  });

  it('when she asks for more seats than any Tesla has left, saying how many are free', async () => {
    const rafiq = await signInAs(app, 'rafiq');
    const r = (await rafiq.post('/api/rides').send(trip('Gulshan 1', { seats: 2 }))).body.ride;
    await putInBulletsPool([r.id]);

    const shirin = await signInAs(app, 'shirin');
    const tooMany = await shirin.post('/api/rides').send(trip('Gulshan 2', { seats: 2 }));
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.details).toEqual({ seatsRequested: 2, maxSeatsFree: 1 });

    // One seat still fits.
    await shirin.post('/api/rides').send(trip('Gulshan 2', { seats: 1 })).expect(201);
  });

  it('when the only Tesla has already started its trip', async () => {
    const rafiq = await signInAs(app, 'rafiq');
    const r = (await rafiq.post('/api/rides').send(trip('Gulshan 1'))).body.ride;
    await putInBulletsPool([r.id], 'STARTED');

    const nusrat = await signInAs(app, 'nusrat');
    expect((await nusrat.post('/api/rides').send(trip('Mohakhali'))).body.error.code).toBe('NO_TESLA_AVAILABLE');
  });
});

describe('cancelling', () => {
  it('lets Nusrat cancel a ride nobody has accepted yet', async () => {
    const nusrat = await signInAs(app, 'nusrat');
    const { body } = await nusrat.post('/api/rides').send(trip('Mohakhali'));

    const res = await nusrat.post(`/api/rides/${body.ride.id}/cancel`).send({ reason: 'Found a CNG' });
    expect(res.status).toBe(200);
    expect(res.body.ride).toMatchObject({ status: 'CANCELLED', cancelReason: 'Found a CNG' });
    expect(res.body.ride.timeline.map((t: { status: string }) => t.status)).toEqual(['REQUESTED', 'CANCELLED']);

    // The active-ride slot is free again.
    await nusrat.post('/api/rides').send(trip('Mohakhali')).expect(201);
  });

  it('gives her seat back to Bullet when she leaves a shared pool', async () => {
    const nusrat = await signInAs(app, 'nusrat');
    const rafiq = await signInAs(app, 'rafiq');
    const n = (await nusrat.post('/api/rides').send(trip('Mohakhali'))).body.ride;
    const r = (await rafiq.post('/api/rides').send(trip('Gulshan 1', { seats: 2 }))).body.ride;
    const poolId = await putInBulletsPool([n.id, r.id], 'DRIVER_ARRIVED');

    await nusrat.post(`/api/rides/${n.id}/cancel`).send({}).expect(200);

    const pool = await prisma.pool.findUniqueOrThrow({ where: { id: poolId }, include: { members: true } });
    expect(pool).toMatchObject({ status: 'DRIVER_ARRIVED', seatsOccupied: 2 });
    expect(pool.members.find((m) => m.rideRequestId === n.id)?.leftAt).not.toBeNull();
    // Rafiq's ride is untouched and no longer counts Nusrat as a co-rider.
    expect((await rafiq.get(`/api/rides/${r.id}`)).body.ride).toMatchObject({
      status: 'DRIVER_ARRIVED',
      tesla: { driverName: 'Jashim', vehicleName: 'Bullet', coRiders: 0 },
    });
  });

  it("cancels Bullet's pool when its last passenger leaves", async () => {
    const nusrat = await signInAs(app, 'nusrat');
    const n = (await nusrat.post('/api/rides').send(trip('Mohakhali'))).body.ride;
    const poolId = await putInBulletsPool([n.id]);

    await nusrat.post(`/api/rides/${n.id}/cancel`).send({}).expect(200);

    expect(await prisma.pool.findUniqueOrThrow({ where: { id: poolId } })).toMatchObject({
      status: 'CANCELLED',
      seatsOccupied: 0,
    });
  });

  it('refuses once the Tesla has started moving', async () => {
    const nusrat = await signInAs(app, 'nusrat');
    const n = (await nusrat.post('/api/rides').send(trip('Mohakhali'))).body.ride;
    await putInBulletsPool([n.id], 'STARTED');

    const res = await nusrat.post(`/api/rides/${n.id}/cancel`).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('frees the seat exactly once when cancel is sent twice at the same instant', async () => {
    const nusrat = await signInAs(app, 'nusrat');
    const rafiq = await signInAs(app, 'rafiq');
    const n = (await nusrat.post('/api/rides').send(trip('Mohakhali'))).body.ride;
    const r = (await rafiq.post('/api/rides').send(trip('Gulshan 1', { seats: 2 }))).body.ride;
    const poolId = await putInBulletsPool([n.id, r.id]);

    const results = await Promise.all([
      nusrat.post(`/api/rides/${n.id}/cancel`).send({}),
      nusrat.post(`/api/rides/${n.id}/cancel`).send({}),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect((await prisma.pool.findUniqueOrThrow({ where: { id: poolId } })).seatsOccupied).toBe(2);
    expect(await prisma.rideStatusHistory.count({ where: { rideRequestId: n.id, toStatus: 'CANCELLED' } })).toBe(1);
  });

  it('refuses to cancel twice', async () => {
    const nusrat = await signInAs(app, 'nusrat');
    const n = (await nusrat.post('/api/rides').send(trip('Mohakhali'))).body.ride;
    await nusrat.post(`/api/rides/${n.id}/cancel`).send({}).expect(200);

    expect((await nusrat.post(`/api/rides/${n.id}/cancel`).send({})).status).toBe(409);
  });

  it("won't let Rafiq cancel Nusrat's ride", async () => {
    const nusrat = await signInAs(app, 'nusrat');
    const rafiq = await signInAs(app, 'rafiq');
    const n = (await nusrat.post('/api/rides').send(trip('Mohakhali'))).body.ride;

    expect((await rafiq.post(`/api/rides/${n.id}/cancel`).send({})).status).toBe(404);
    expect((await prisma.rideRequest.findUniqueOrThrow({ where: { id: n.id } })).status).toBe('REQUESTED');
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
