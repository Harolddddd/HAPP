import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { calculateBmi } from '../utils/bmi';

export const profileRouter = Router();

profileRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
  const profile = await prisma.healthProfile.findUnique({ where: { userId: req.userId! } });
  if (!profile) {
    return res.status(404).json({ error: 'Health profile not found' });
  }
  res.json({ ...profile, bmi: calculateBmi(profile.heightCm, profile.weightKg) });
});

profileRouter.put('/', requireAuth, async (req: AuthRequest, res) => {
  const { age, gender, heightCm, weightKg, chronicConditions, medications, allergies } = req.body;

  if (
    typeof age !== 'number' ||
    typeof gender !== 'string' ||
    typeof heightCm !== 'number' ||
    typeof weightKg !== 'number'
  ) {
    return res.status(400).json({ error: 'age, gender, heightCm and weightKg are required' });
  }

  const profile = await prisma.healthProfile.upsert({
    where: { userId: req.userId! },
    update: {
      age,
      gender,
      heightCm,
      weightKg,
      chronicConditions: chronicConditions ?? [],
      medications: medications ?? [],
      allergies: allergies ?? null,
    },
    create: {
      userId: req.userId!,
      age,
      gender,
      heightCm,
      weightKg,
      chronicConditions: chronicConditions ?? [],
      medications: medications ?? [],
      allergies: allergies ?? null,
    },
  });

  res.json({ ...profile, bmi: calculateBmi(profile.heightCm, profile.weightKg) });
});
