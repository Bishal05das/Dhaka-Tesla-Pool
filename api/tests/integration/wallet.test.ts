import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { signInAs } from '../helpers/auth.js';
import { resetDatabase } from '../helpers/db.js';

const app = createApp();

beforeEach(resetDatabase);

describe('TeslaPay wallet', () => {
  it("shows Shirin's ৳500 starting balance and an empty ledger", async () => {
    const shirin = await signInAs(app, 'shirin');
    expect((await shirin.get('/api/wallet')).body).toEqual({ balancePoisha: 50000, transactions: [] });
  });

  it('tops up a new passenger from ৳0 and records it in the ledger', async () => {
    const tania = request.agent(app);
    await tania
      .post('/api/auth/register')
      .send({ role: 'PASSENGER', name: 'Tania', email: 'tania@dhakatesla.test', password: 'banani-road-11' })
      .expect(201);

    const res = await tania.post('/api/wallet/topup').send({ amountPoisha: 20000 });
    expect(res.body).toEqual({ balancePoisha: 20000 });

    const wallet = (await tania.get('/api/wallet')).body;
    expect(wallet.transactions).toMatchObject([{ type: 'TOPUP', amountPoisha: 20000, balanceAfterPoisha: 20000 }]);
  });

  it('applies both of two simultaneous top-ups', async () => {
    const rafiq = await signInAs(app, 'rafiq');
    await Promise.all([
      rafiq.post('/api/wallet/topup').send({ amountPoisha: 10000 }),
      rafiq.post('/api/wallet/topup').send({ amountPoisha: 10000 }),
    ]);

    const wallet = (await rafiq.get('/api/wallet')).body;
    expect(wallet.balancePoisha).toBe(70000);
    expect(wallet.transactions.map((t: { balanceAfterPoisha: number }) => t.balanceAfterPoisha).sort()).toEqual([
      60000, 70000,
    ]);
  });

  it.each([0, -500, 99, 500_001, 150.5])('rejects a top-up of %s poisha', async (amountPoisha) => {
    const nusrat = await signInAs(app, 'nusrat');
    expect((await nusrat.post('/api/wallet/topup').send({ amountPoisha })).status).toBe(400);
  });

  it('is for passengers only', async () => {
    const jashim = await signInAs(app, 'jashim');
    expect((await jashim.get('/api/wallet')).status).toBe(403);
  });
});
