import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { driverRouter } from './modules/driver/driver.routes.js';
import { faresRouter } from './modules/fares/fares.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { poolsRouter } from './modules/pools/pools.routes.js';
import { ridesRouter } from './modules/rides/rides.routes.js';
import { stopsRouter } from './modules/stops/stops.routes.js';
import { walletRouter } from './modules/wallet/wallet.routes.js';

export function createApp(): Express {
  const app = express();

  // Proxies sit in front of the API (Next.js locally; Vercel and Render in production). Trust
  // exactly that many hops so req.ip is the visitor: trusting too few rate-limits everyone as
  // one proxy address; trusting too many lets a client spoof its address.
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(requestLogger);
  app.use(helmet());
  // The web app normally reaches the API through its same-origin /api rewrite, so CORS
  // only matters for direct calls; allow just the configured origins, with cookies.
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use(healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/stops', stopsRouter);
  app.use('/api/fares', faresRouter);
  app.use('/api/rides', ridesRouter);
  app.use('/api/driver', driverRouter);
  app.use('/api/pools', poolsRouter);
  app.use('/api/wallet', walletRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
