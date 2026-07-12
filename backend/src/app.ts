import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';

export const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
