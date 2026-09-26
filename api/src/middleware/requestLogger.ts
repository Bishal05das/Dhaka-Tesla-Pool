import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger.js';

// Every request gets an id (reused from X-Request-Id if a proxy set one),
// echoed back in the response so a user-reported error can be found in the logs.
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && incoming.length <= 64 ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  autoLogging: { ignore: (req) => req.url === '/health' },
  // clientIp is the address after proxy trust is applied: what the rate limiter keys on.
  // `forwarded` is the raw chain the proxies sent, so TRUST_PROXY can be set from what the
  // hosting platform actually does rather than from assumptions (see README, Deployment).
  customProps: (req) => ({
    clientIp: (req as { ip?: string }).ip,
    forwarded: {
      xff: req.headers['x-forwarded-for'],
      realIp: req.headers['x-real-ip'],
      cfConnectingIp: req.headers['cf-connecting-ip'],
      trueClientIp: req.headers['true-client-ip'],
      socket: req.socket.remoteAddress,
    },
  }),
});
