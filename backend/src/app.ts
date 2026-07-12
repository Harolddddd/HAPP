import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { profileRouter } from './routes/profile';
import { recordsRouter } from './routes/records';

export const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRouter);
app.use('/profile', profileRouter);
app.use('/records', recordsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
