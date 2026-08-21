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
