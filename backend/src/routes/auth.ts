import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const authRouter = Router();

const VALID_ROLES = ['patient', 'doctor'];

authRouter.post('/register', asyncHandler(async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password and name are required' });
  }
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'role must be one of ' + VALID_ROLES.join(', ') });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role: role ?? 'patient' },
  });

  const token = signToken(user.id, user.role);
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user.id, user.role);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
}));

function signToken(userId: string, role: string): string {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return jwt.sign({ userId, role }, secret, { expiresIn: '30d' });
}
