import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { profileRouter } from './routes/profile';
import { recordsRouter } from './routes/records';
import { remindersRouter } from './routes/reminders';

export const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRouter);
app.use('/profile', profileRouter);
app.use('/records', recordsRouter);
app.use('/reminders', remindersRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
