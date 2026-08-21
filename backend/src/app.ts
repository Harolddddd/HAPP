import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { profileRouter } from './routes/profile';
import { recordsRouter } from './routes/records';
import { remindersRouter } from './routes/reminders';
import { adherenceRouter } from './routes/adherence';
import { doctorRouter } from './routes/doctor';
import { usageEventsRouter } from './routes/usageEvents';
import { adminRouter } from './routes/admin';

export const app = express();

// In production this app runs behind the Nginx reverse proxy in
// deploy/nginx-api.conf, which always connects from localhost. Without this,
// Express reports the proxy's own loopback address as `req.ip` for every
// request and express-rate-limit's per-IP auth limiter collapses into a single
// global bucket for the whole internet. Deliberately 'loopback' rather than
// `true`: a permissive setting would let any client spoof X-Forwarded-For and
// bypass the limiter entirely.
app.set('trust proxy', 'loopback');

const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim());
app.use(cors(corsOrigins ? { origin: corsOrigins } : { origin: true }));
app.use(express.json());
app.use('/auth', authRouter);
app.use('/profile', profileRouter);
app.use('/records', recordsRouter);
app.use('/reminders', remindersRouter);
app.use('/adherence', adherenceRouter);
app.use('/doctor', doctorRouter);
app.use('/usage-events', usageEventsRouter);
app.use('/admin', adminRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
