import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD } from '../../prisma/seed-data.js';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signInAs } from '../helpers/auth.js';
import { resetDatabase } from '../helpers/db.js';

const app = createApp();

beforeEach(resetDatabase);

const newPassenger = { role: 'PASSENGER', name: 'Tania', email: 'Tania@DhakaTesla.test', password: 'banani-road-11' };

describe('passenger sign-up', () => {
  it('creates the account, an empty wallet, and signs the passenger in', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send(newPassenger);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Tania', email: 'tania@dhakatesla.test', role: 'PASSENGER' });
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/dt_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: res.body.user.id } });
    expect(wallet.balancePoisha).toBe(0);

    const me = await agent.get('/api/auth/me');
    expect(me.body.user.email).toBe('tania@dhakatesla.test');
  });

  it('stores a bcrypt hash, never the password', async () => {
    await request(app).post('/api/auth/register').send(newPassenger);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'tania@dhakatesla.test' } });
    expect(user.passwordHash).toMatch(/^\$2[aby]\$10\$/);
    expect(user.passwordHash).not.toContain('banani-road-11');
  });

  it("rejects an email that's already taken, regardless of case", async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...newPassenger, email: 'NUSRAT@dhakatesla.test' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/already registered/);
  });

  it('rejects invalid input with field errors', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ role: 'PASSENGER', name: '', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details).sort()).toEqual(['email', 'name', 'password']);
  });
});

describe('login and logout', () => {
  it('signs Nusrat in with the demo password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nusrat@dhakatesla.test', password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Nusrat', role: 'PASSENGER', vehicle: null });
  });

  it("returns Jashim's Tesla with his account", async () => {
    const agent = await signInAs(app, 'jashim');
    const me = await agent.get('/api/auth/me');
    expect(me.body.user).toMatchObject({ role: 'DRIVER', vehicle: { name: 'Bullet', capacity: 3 } });
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nusrat@dhakatesla.test', password: 'wrong-password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@dhakatesla.test', password: 'wrong-password' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it('clears the session on logout', async () => {
    const agent = await signInAs(app, 'rafiq');
    expect((await agent.get('/api/auth/me')).status).toBe(200);

    await agent.post('/api/auth/logout').expect(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects /me without a session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
