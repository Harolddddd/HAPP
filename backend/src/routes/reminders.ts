import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const remindersRouter = Router();

const VALID_TYPES = ['blood_pressure', 'medication', 'exercise', 'blood_glucose', 'custom'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validateReminderInput(body: any): string[] {
  const errors: string[] = [];
  if (!VALID_TYPES.includes(body.type)) {
    errors.push('type must be one of ' + VALID_TYPES.join(', '));
  }
  if (body.type === 'custom' && (typeof body.title !== 'string' || body.title.trim() === '')) {
    errors.push('title is required for custom reminders');
  }
  if (typeof body.time !== 'string' || !TIME_RE.test(body.time)) {
    errors.push('time must be in HH:mm format');
  }
  if (
    !Array.isArray(body.weekdays) ||
    body.weekdays.length === 0 ||
    !body.weekdays.every((w: unknown) => typeof w === 'number' && w >= 0 && w <= 6)
  ) {
    errors.push('weekdays must be a non-empty array of integers between 0 and 6');
  }
  return errors;
}

remindersRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const reminders = await prisma.reminder.findMany({
      where: { userId: req.userId! },
      orderBy: { time: 'asc' },
    });
    res.json(reminders);
  })
);

remindersRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const errors = validateReminderInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }
    const { type, title, time, weekdays } = req.body;
    const reminder = await prisma.reminder.create({
      data: { userId: req.userId!, type, title: title ?? '', time, weekdays, enabled: true },
    });
    res.status(201).json(reminder);
  })
);

remindersRouter.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const existing = await prisma.reminder.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const merged = { ...existing, ...req.body };
    const errors = validateReminderInput(merged);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const reminder = await prisma.reminder.update({
      where: { id: req.params.id },
      data: {
        type: merged.type,
        title: merged.title ?? '',
        time: merged.time,
        weekdays: merged.weekdays,
        enabled: typeof req.body.enabled === 'boolean' ? req.body.enabled : existing.enabled,
      },
    });
    res.json(reminder);
  })
);

remindersRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const existing = await prisma.reminder.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: 'Reminder not found' });
    }
    await prisma.reminder.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
