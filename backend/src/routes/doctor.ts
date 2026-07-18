import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { calculateBmi } from '../utils/bmi';
import { calculateAdherence } from '../utils/adherence';

export const doctorRouter = Router();

doctorRouter.use(requireAuth, requireRole('doctor'));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateKey(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(value);
  return !isNaN(parsed.getTime());
}

async function findPatient(id: string) {
  const patient = await prisma.user.findUnique({ where: { id } });
  if (!patient || patient.role !== 'patient') return null;
  return patient;
}

doctorRouter.get(
  '/patients',
  asyncHandler(async (req, res) => {
    const condition = typeof req.query.condition === 'string' ? req.query.condition : undefined;

    const patients = await prisma.user.findMany({
      where: {
        role: 'patient',
        ...(condition ? { healthProfile: { chronicConditions: { has: condition } } } : {}),
      },
      select: {
        id: true,
        name: true,
        healthProfile: { select: { age: true, chronicConditions: true } },
      },
    });

    res.json(
      patients.map((p) => ({
        id: p.id,
        name: p.name,
        age: p.healthProfile?.age ?? null,
        chronicConditions: p.healthProfile?.chronicConditions ?? [],
      }))
    );
  })
);

doctorRouter.get(
  '/patients/:id/profile',
  asyncHandler(async (req, res) => {
    const patient = await findPatient(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const profile = await prisma.healthProfile.findUnique({ where: { userId: req.params.id } });
    if (!profile) {
      return res.status(404).json({ error: 'Health profile not found' });
    }

    res.json({ ...profile, bmi: calculateBmi(profile.heightCm, profile.weightKg) });
  })
);

doctorRouter.get(
  '/patients/:id/records',
  asyncHandler(async (req, res) => {
    const patient = await findPatient(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const days = req.query.days ? Number(req.query.days) : 90;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const records = await prisma.dailyRecord.findMany({
      where: { userId: req.params.id, recordDate: { gte: since } },
      orderBy: { recordDate: 'asc' },
    });

    res.json(records);
  })
);

doctorRouter.get(
  '/patients/:id/adherence',
  asyncHandler(async (req, res) => {
    const patient = await findPatient(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const todayParam = typeof req.query.today === 'string' ? req.query.today : undefined;
    const todayKey = todayParam && isValidDateKey(todayParam) ? todayParam : new Date().toISOString().slice(0, 10);

    const since = new Date(todayKey);
    since.setUTCDate(since.getUTCDate() - 29);

    const records = await prisma.dailyRecord.findMany({
      where: { userId: req.params.id, recordDate: { gte: since } },
      select: { recordDate: true },
    });

    const result = calculateAdherence(
      records.map((r) => r.recordDate),
      todayKey
    );
    res.json(result);
  })
);
