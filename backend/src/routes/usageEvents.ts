import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const usageEventsRouter = Router();

usageEventsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { screen } = req.body;
    if (typeof screen !== 'string' || screen.trim() === '') {
      return res.status(400).json({ error: 'screen is required' });
    }

    await prisma.usageEvent.create({
      data: { userId: req.userId!, screen },
    });

    res.status(201).json({ ok: true });
  })
);
