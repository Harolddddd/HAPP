import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { calculateContinuousUsers, calculateAvgDailyActiveUsers, calculateTopFeatures } from '../utils/usageStats';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const todayKey = new Date().toISOString().slice(0, 10);

    const since90 = new Date(todayKey);
    since90.setUTCDate(since90.getUTCDate() - 89);

    const patientEvents = await prisma.usageEvent.findMany({
      where: { user: { role: 'patient' }, createdAt: { gte: since90 } },
      select: { userId: true, createdAt: true },
    });

    const continuousUsers = calculateContinuousUsers(
      patientEvents.map((e) => ({ userId: e.userId, date: e.createdAt })),
      todayKey
    );

    const since30 = new Date(todayKey);
    since30.setUTCDate(since30.getUTCDate() - 29);

    const patientEvents30 = patientEvents.filter((e) => e.createdAt >= since30);
    const avgDailyActiveUsers = calculateAvgDailyActiveUsers(
      patientEvents30.map((e) => ({ userId: e.userId, date: e.createdAt })),
      todayKey
    );

    const allEvents30 = await prisma.usageEvent.findMany({
      where: { createdAt: { gte: since30 } },
      select: { screen: true },
    });
    const topFeatures = calculateTopFeatures(allEvents30, 10);

    res.json({ continuousUsers, avgDailyActiveUsers, topFeatures });
  })
);
