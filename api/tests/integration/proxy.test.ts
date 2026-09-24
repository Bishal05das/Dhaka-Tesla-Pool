import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// What req.ip becomes for a given TRUST_PROXY and X-Forwarded-For chain. Each proxy appends the
// address it received the request from, so the visitor is `hops` entries from the right.
function appTrusting(hops: number) {
  const app = express();
  app.set('trust proxy', hops);
  app.get('/ip', (req, res) => {
    res.json({ ip: req.ip });
  });
  return app;
}

describe('client address behind proxies', () => {
  it('docker compose (self-hosted Next.js adds no address): 0 hops ignores a faked header', async () => {
    const res = await request(appTrusting(0)).get('/ip').set('X-Forwarded-For', '103.4.5.6');
    expect(res.body.ip).not.toBe('103.4.5.6');
  });

  it('Vercel -> Render: 2 hops give the visitor, not the Vercel proxy', async () => {
    // As Render receives it: visitor, then Vercel's egress address.
    const chain = '103.4.5.6, 76.76.21.9';
    expect((await request(appTrusting(1)).get('/ip').set('X-Forwarded-For', chain)).body.ip).toBe('76.76.21.9');
    expect((await request(appTrusting(2)).get('/ip').set('X-Forwarded-For', chain)).body.ip).toBe('103.4.5.6');
  });

  it("ignores addresses a client adds to the front of the chain itself", async () => {
    // A client sending its own X-Forwarded-For can only prepend; trusted hops are counted from the right.
    const spoofed = '1.1.1.1, 103.4.5.6, 76.76.21.9';
    expect((await request(appTrusting(2)).get('/ip').set('X-Forwarded-For', spoofed)).body.ip).toBe('103.4.5.6');
  });
});
