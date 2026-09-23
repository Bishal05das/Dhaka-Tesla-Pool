import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { resetDatabase } from '../helpers/db.js';

beforeAll(resetDatabase);

describe('seed data', () => {
  it('puts the route stops in order with whole-km distances', async () => {
    const stops = await prisma.stop.findMany({ orderBy: { sequence: 'asc' } });
    expect(stops.map((s) => [s.name, s.distanceFromStartM])).toEqual([
      ['Banani', 0],
      ['Mohakhali', 3000],
      ['Gulshan 1', 5000],
      ['Gulshan 2', 7000],
      ['Bashundhara', 10000],
    ]);
  });

  it('gives Jashim his 3-seat Tesla, Bullet', async () => {
    const bullet = await prisma.vehicle.findFirstOrThrow({ include: { driver: true } });
    expect(bullet).toMatchObject({ name: 'Bullet', capacity: 3, driver: { name: 'Jashim', role: 'DRIVER' } });
  });

  it('gives each passenger ৳500 in TeslaPay', async () => {
    const wallets = await prisma.wallet.findMany({ include: { user: true } });
    expect(wallets.map((w) => [w.user.name, w.balancePoisha]).sort()).toEqual([
      ['Nusrat', 50000],
      ['Rafiq', 50000],
      ['Shirin', 50000],
    ]);
  });

  it('can be run twice without duplicating anything', async () => {
    await resetDatabase();
    expect(await prisma.user.count()).toBe(4);
    expect(await prisma.stop.count()).toBe(5);
  });
});
