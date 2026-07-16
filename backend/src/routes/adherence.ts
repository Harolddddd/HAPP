import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { calculateAdherence } from '../utils/adherence';

export const adherenceRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

adherenceRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const todayParam = typeof req.query.today === 'string' ? req.query.today : undefined;
    const todayKey = todayParam && DATE_RE.test(todayParam) ? todayParam : new Date().toISOString().slice(0, 10);

    const since = new Date(todayKey);
    since.setUTCDate(since.getUTCDate() - 29);

    const records = await prisma.dailyRecord.findMany({
      where: { userId: req.userId!, recordDate: { gte: since } },
      select: { recordDate: true },
    });

    const result = calculateAdherence(
      records.map((r) => r.recordDate),
      todayKey
    );
    res.json(result);
  })
);
