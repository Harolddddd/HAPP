import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validateDailyRecord } from '../utils/validators';

export const recordsRouter = Router();

recordsRouter.post('/', requireAuth, async (req: AuthRequest, res) => {
  const {
    recordDate,
    systolic,
    diastolic,
    bloodGlucose,
    heartRate,
    weightKg,
    sleepHours,
    exerciseMinutes,
    waterMl,
  } = req.body;

  if (!recordDate) {
    return res.status(400).json({ error: 'recordDate is required (YYYY-MM-DD)' });
  }

  const errors = validateDailyRecord({
    systolic,
    diastolic,
    bloodGlucose,
    heartRate,
    weightKg,
    sleepHours,
    exerciseMinutes,
    waterMl,
  });
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const data = { systolic, diastolic, bloodGlucose, heartRate, weightKg, sleepHours, exerciseMinutes, waterMl };

  const record = await prisma.dailyRecord.upsert({
    where: { userId_recordDate: { userId: req.userId!, recordDate: new Date(recordDate) } },
    update: data,
    create: { userId: req.userId!, recordDate: new Date(recordDate), ...data },
  });

  res.status(200).json(record);
});

recordsRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
  const days = req.query.days ? Number(req.query.days) : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const records = await prisma.dailyRecord.findMany({
    where: { userId: req.userId!, recordDate: { gte: since } },
    orderBy: { recordDate: 'asc' },
  });

  res.json(records);
});
