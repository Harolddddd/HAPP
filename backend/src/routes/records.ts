import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validateDailyRecord } from '../utils/validators';
import { asyncHandler } from '../utils/asyncHandler';

export const recordsRouter = Router();

const RECORD_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

recordsRouter.post('/', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
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

  if (typeof recordDate !== 'string' || !RECORD_DATE_RE.test(recordDate)) {
    return res.status(400).json({ error: 'recordDate must be in YYYY-MM-DD format' });
  }

  const parsedDate = new Date(recordDate);
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({ error: 'recordDate must be a valid date' });
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
    where: { userId_recordDate: { userId: req.userId!, recordDate: parsedDate } },
    update: data,
    create: { userId: req.userId!, recordDate: parsedDate, ...data },
  });

  res.status(200).json(record);
}));

recordsRouter.get('/', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const days = req.query.days ? Number(req.query.days) : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const records = await prisma.dailyRecord.findMany({
    where: { userId: req.userId!, recordDate: { gte: since } },
    orderBy: { recordDate: 'asc' },
  });

  res.json(records);
}));
