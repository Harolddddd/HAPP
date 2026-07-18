# HAPP Phase 3 Implementation Plan — Read-Only Doctor Portal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add module 6 (doctor portal) to HAPP — doctors can register, log in, browse the full patient list filtered by chronic condition, and view any patient's health profile, adherence stats, and 90-day trend chart.

**Architecture:** Builds on the Phase 1/2 monorepo (`backend/` Express+Prisma, `mobile/` Expo+React Navigation). No new tables — doctor access is role-gated (`requireRole('doctor')`) against the existing `User`/`HealthProfile`/`DailyRecord` tables, with every doctor able to see every patient (no per-doctor patient linking). The mobile app splits its authenticated navigation by `user.role` into a patient stack (existing, unchanged) or a doctor stack (new).

**Tech Stack:** Same as Phase 1/2, no new dependencies.

## Global Constraints

- TypeScript `strict: true` in both packages.
- `POST /auth/register` accepts an optional `role` field, validated against `['patient', 'doctor']`; defaults to `'patient'` when omitted. `'admin'` is never accepted via registration.
- `requireRole(role: string)` middleware (new): returns 403 `{ error: 'Forbidden' }` when `req.role !== role`; must run after `requireAuth` (which populates `req.role`).
- All `/doctor/*` routes require `requireAuth` + `requireRole('doctor')`.
- `/doctor/patients/:id/*` routes return 404 `{ error: 'Patient not found' }` when the target user doesn't exist or isn't `role === 'patient'` (a doctor cannot use these routes to inspect another doctor's or an admin's data).
- Doctor's patient trend chart window is 90 days (vs. the patient's own 30-day `TrendsScreen`). Doctor's patient adherence window stays 30 days, reusing `calculateAdherence` unchanged.
- `GET /auth/me` (new): requires `requireAuth`, returns `{ id, email, name, role }` for the authenticated user — used by the mobile app to recover `role` after restoring a token from `SecureStore` on cold start (today, only `token` is restored on cold start; `user` — and therefore `role` — is not, which Phase 1/2 never needed since the UI didn't branch on role).
- Commit after every task.

---

### Task 1: Role-aware registration + `requireRole` middleware + `GET /auth/me`

**Files:**
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/src/routes/auth.ts`
- Modify: `backend/tests/auth.test.ts`

**Interfaces:**
- Produces: `requireRole(role: string)` (returns an Express middleware) from `backend/src/middleware/auth.ts`, alongside the existing `requireAuth`/`AuthRequest` — used by Task 2's doctor routes. `POST /auth/register` now accepts an optional `role` body field. `GET /auth/me` (new route on `authRouter`) returns `{ id, email, name, role }`.

- [ ] **Step 1: Add `requireRole` to `backend/src/middleware/auth.ts`**

Current file (for reference):

```ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  role?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const payload = jwt.verify(token, secret) as { userId: string; role: string };
    req.userId = payload.userId;
    req.role = payload.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

Add this function at the end of the file:

```ts
export function requireRole(role: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

- [ ] **Step 2: Add role support to `POST /auth/register` and add `GET /auth/me` in `backend/src/routes/auth.ts`**

Current file (for reference):

```ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { asyncHandler } from '../utils/asyncHandler';

export const authRouter = Router();

authRouter.post('/register', asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password and name are required' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role: 'patient' },
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

function signToken(userId: string, role: string): string {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return jwt.sign({ userId, role }, secret, { expiresIn: '30d' });
}
```

Replace the whole file with:

```ts
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
```

- [ ] **Step 3: Add the failing tests**

Add these new `describe` blocks to `backend/tests/auth.test.ts` (append after the existing `describe('POST /auth/login', ...)` block; the existing `import`s, `jest.mock`, and `mockedPrisma` at the top of the file already cover `prisma.user.findUnique`/`create`, no changes needed there):

```ts
describe('POST /auth/register role handling', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defaults to patient when role is omitted', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      name: 'Alice',
      role: 'patient',
      passwordHash: 'hashed',
    });

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'a@example.com', password: 'password123', name: 'Alice' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('patient');
  });

  it('creates a doctor account when role is doctor', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.user.create.mockResolvedValue({
      id: 'doc-1',
      email: 'doc@example.com',
      name: 'Dr. Smith',
      role: 'doctor',
      passwordHash: 'hashed',
    });

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'doc@example.com', password: 'password123', name: 'Dr. Smith', role: 'doctor' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('doctor');
  });

  it('rejects an invalid role with 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'a@example.com', password: 'password123', name: 'Alice', role: 'admin' });

    expect(res.status).toBe(400);
  });
});

describe('GET /auth/me', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      name: 'Alice',
      role: 'patient',
      passwordHash: 'hashed',
    });

    const token = jwt.sign({ userId: 'user-1', role: 'patient' }, process.env.JWT_SECRET || 'dev-secret');
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'user-1', email: 'a@example.com', name: 'Alice', role: 'patient' });
  });

  it('returns 404 when the user no longer exists', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const token = jwt.sign({ userId: 'ghost', role: 'patient' }, process.env.JWT_SECRET || 'dev-secret');
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
```

The file does not yet import `jwt` (only `bcrypt`). Add `import jwt from 'jsonwebtoken';` as a new line directly below the existing `import bcrypt from 'bcryptjs';` at the top of `backend/tests/auth.test.ts` — the new `GET /auth/me` tests above use `jwt.sign(...)` directly to construct a valid token.

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx jest tests/auth.test.ts`
Expected: FAIL — role tests fail because `role` isn't handled yet; `/me` tests fail with 404 (route not found).

- [ ] **Step 5: Apply Steps 1-2's implementation, then run tests to verify they pass**

Run: `npx jest tests/auth.test.ts`
Expected: PASS, 11 passed (5 existing + 6 new).

- [ ] **Step 6: Commit**

```bash
git add backend/src/middleware/auth.ts backend/src/routes/auth.ts backend/tests/auth.test.ts
git commit -m "feat(backend): add role-aware registration, requireRole middleware, GET /auth/me"
```

---

### Task 2: Doctor routes

**Files:**
- Create: `backend/src/routes/doctor.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/doctor.test.ts`

**Interfaces:**
- Consumes: `requireAuth`/`requireRole`/`AuthRequest` (Task 1), `calculateBmi` (Phase 1), `calculateAdherence` (Phase 2), `asyncHandler`.
- Produces: `doctorRouter` mounted at `/doctor` — `GET /patients?condition=<chronicCondition>`, `GET /patients/:id/profile`, `GET /patients/:id/records?days=90`, `GET /patients/:id/adherence?today=YYYY-MM-DD`. All require `role === 'doctor'`; all `:id` routes 404 when the target isn't an existing `role === 'patient'` user.

- [ ] **Step 1: Create `backend/src/routes/doctor.ts`**

```ts
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
```

- [ ] **Step 2: Mount the router in `backend/src/app.ts`**

Current file (for reference):

```ts
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { profileRouter } from './routes/profile';
import { recordsRouter } from './routes/records';
import { remindersRouter } from './routes/reminders';
import { adherenceRouter } from './routes/adherence';

export const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRouter);
app.use('/profile', profileRouter);
app.use('/records', recordsRouter);
app.use('/reminders', remindersRouter);
app.use('/adherence', adherenceRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
```

Add the import after the `adherenceRouter` import:

```ts
import { doctorRouter } from './routes/doctor';
```

Add the mount after `app.use('/adherence', adherenceRouter);` (before `/health` and the error-handling middleware, which must stay last):

```ts
app.use('/doctor', doctorRouter);
```

- [ ] **Step 3: Write the failing tests**

`backend/tests/doctor.test.ts`:

```ts
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    healthProfile: {
      findUnique: jest.fn(),
    },
    dailyRecord: {
      findMany: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  user: { findMany: jest.Mock; findUnique: jest.Mock };
  healthProfile: { findUnique: jest.Mock };
  dailyRecord: { findMany: jest.Mock };
};

function authHeader(userId = 'doctor-1', role = 'doctor') {
  const token = jwt.sign({ userId, role }, process.env.JWT_SECRET || 'dev-secret');
  return `Bearer ${token}`;
}

describe('GET /doctor/patients', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/doctor/patients');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-doctor role', async () => {
    const res = await request(app).get('/doctor/patients').set('Authorization', authHeader('patient-1', 'patient'));
    expect(res.status).toBe(403);
  });

  it('returns the patient list', async () => {
    mockedPrisma.user.findMany.mockResolvedValue([
      { id: 'p1', name: 'Alice', healthProfile: { age: 40, chronicConditions: ['高血压'] } },
      { id: 'p2', name: 'Bob', healthProfile: null },
    ]);

    const res = await request(app).get('/doctor/patients').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 'p1', name: 'Alice', age: 40, chronicConditions: ['高血压'] },
      { id: 'p2', name: 'Bob', age: null, chronicConditions: [] },
    ]);
  });

  it('filters by chronic condition when provided', async () => {
    mockedPrisma.user.findMany.mockResolvedValue([]);

    await request(app).get('/doctor/patients').query({ condition: '高血压' }).set('Authorization', authHeader());

    expect(mockedPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: 'patient', healthProfile: { chronicConditions: { has: '高血压' } } },
      })
    );
  });
});

describe('GET /doctor/patients/:id/profile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when the target user is not a patient', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 'doctor-2', role: 'doctor' });

    const res = await request(app).get('/doctor/patients/doctor-2/profile').set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('returns the patient profile with bmi', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 'p1', role: 'patient' });
    mockedPrisma.healthProfile.findUnique.mockResolvedValue({
      id: 'hp1',
      userId: 'p1',
      age: 40,
      gender: 'female',
      heightCm: 160,
      weightKg: 50,
      chronicConditions: [],
      medications: [],
      allergies: null,
    });

    const res = await request(app).get('/doctor/patients/p1/profile').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.bmi).toBe(19.5);
  });
});

describe('GET /doctor/patients/:id/records', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when the target user is not a patient', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/doctor/patients/missing/records').set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('returns the patient records', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 'p1', role: 'patient' });
    mockedPrisma.dailyRecord.findMany.mockResolvedValue([{ id: 'r1' }]);

    const res = await request(app).get('/doctor/patients/p1/records').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('GET /doctor/patients/:id/adherence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when the target user is not a patient', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/doctor/patients/missing/adherence').set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('computes adherence for the patient', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 'p1', role: 'patient' });
    mockedPrisma.dailyRecord.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/doctor/patients/p1/adherence')
      .query({ today: '2026-07-13' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.completedDays).toBe(0);
  });
});
```

- [ ] **Step 4: Run tests and verify pass**

Run: `npx jest tests/doctor.test.ts`
Expected: PASS, 10 passed.

- [ ] **Step 5: Run the full backend suite**

Run: `npm test`
Expected: all backend test files pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/doctor.ts backend/src/app.ts backend/tests/doctor.test.ts
git commit -m "feat(backend): add read-only doctor routes for patient list/profile/records/adherence"
```

---

### Task 3: Mobile API wrappers + navigation types + AuthContext role restoration

**Files:**
- Modify: `mobile/src/api/auth.ts`
- Modify: `mobile/src/context/AuthContext.tsx`
- Create: `mobile/src/api/doctor.ts`
- Modify: `mobile/src/navigation/types.ts`

**Interfaces:**
- Produces: `UserRole` type + `getMe()` added to `mobile/src/api/auth.ts`; `register()` gains an optional 4th `role: UserRole = 'patient'` parameter (backward-compatible — existing 3-arg call sites keep compiling until Task 4 updates them); `AuthContext`'s `user` state is now populated on cold start (not just after `login`/`register`); `PatientSummary`/`PatientProfile`/`PatientRecord`/`PatientAdherence` types + `getPatients`/`getPatientProfile`/`getPatientRecords`/`getPatientAdherence` from `mobile/src/api/doctor.ts`; `RootStackParamList` gains `DoctorPatientList: undefined` and `DoctorPatientDetail: { patientId: string; patientName: string }` — used by Tasks 5-7.

- [ ] **Step 1: Replace `mobile/src/api/auth.ts`**

```ts
import { apiClient } from './client';

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; name: string; role: string };
}

export type UserRole = 'patient' | 'doctor';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  return res.data;
}

export async function register(
  email: string,
  password: string,
  name: string,
  role: UserRole = 'patient'
): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/register', { email, password, name, role });
  return res.data;
}

export async function getMe(): Promise<AuthResponse['user']> {
  const res = await apiClient.get<AuthResponse['user']>('/auth/me');
  return res.data;
}
```

- [ ] **Step 2: Replace `mobile/src/context/AuthContext.tsx`**

Current file (for reference):

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { login as apiLogin, register as apiRegister } from '../api/auth';
import { setAuthToken, setUnauthorizedHandler } from '../api/client';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'happ_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY).then((stored) => {
      if (stored) {
        setAuthToken(stored);
        setToken(stored);
      }
      setIsLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    const res = await apiLogin(email, password);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function register(email: string, password: string, name: string) {
    const res = await apiRegister(email, password, name);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

Replace the whole file with:

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { login as apiLogin, register as apiRegister, getMe as apiGetMe, UserRole } from '../api/auth';
import { setAuthToken, setUnauthorizedHandler } from '../api/client';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'happ_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY).then(async (stored) => {
      if (stored) {
        setAuthToken(stored);
        setToken(stored);
        try {
          const me = await apiGetMe();
          setUser(me);
        } catch {
          // token invalid/expired — the response interceptor's unauthorized
          // handler will log out on the next request that hits a 401
        }
      }
      setIsLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    const res = await apiLogin(email, password);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function register(email: string, password: string, name: string, role: UserRole = 'patient') {
    const res = await apiRegister(email, password, name, role);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 3: Create `mobile/src/api/doctor.ts`**

```ts
import { apiClient } from './client';
import { todayLocalDate } from '../utils/date';

export interface PatientSummary {
  id: string;
  name: string;
  age: number | null;
  chronicConditions: string[];
}

export interface PatientProfile {
  id: string;
  userId: string;
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  chronicConditions: string[];
  medications: string[];
  allergies: string | null;
  bmi: number;
}

export interface PatientRecord {
  id: string;
  userId: string;
  recordDate: string;
  systolic: number | null;
  diastolic: number | null;
  bloodGlucose: number | null;
  heartRate: number | null;
  weightKg: number | null;
  sleepHours: number | null;
  exerciseMinutes: number | null;
  waterMl: number | null;
}

export interface PatientAdherence {
  completedDays: number;
  missedDays: number;
  completionRate: number;
  currentStreak: number;
}

export async function getPatients(condition?: string): Promise<PatientSummary[]> {
  const res = await apiClient.get<PatientSummary[]>('/doctor/patients', {
    params: condition ? { condition } : undefined,
  });
  return res.data;
}

export async function getPatientProfile(patientId: string): Promise<PatientProfile> {
  const res = await apiClient.get<PatientProfile>(`/doctor/patients/${patientId}/profile`);
  return res.data;
}

export async function getPatientRecords(patientId: string, days = 90): Promise<PatientRecord[]> {
  const res = await apiClient.get<PatientRecord[]>(`/doctor/patients/${patientId}/records`, { params: { days } });
  return res.data;
}

export async function getPatientAdherence(patientId: string): Promise<PatientAdherence> {
  const res = await apiClient.get<PatientAdherence>(`/doctor/patients/${patientId}/adherence`, {
    params: { today: todayLocalDate() },
  });
  return res.data;
}
```

- [ ] **Step 4: Replace `mobile/src/navigation/types.ts`**

```ts
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ProfileSetup: undefined;
  Home: undefined;
  DailyRecord: undefined;
  History: undefined;
  Trends: undefined;
  Reminders: undefined;
  ReminderForm: { reminderId?: string };
  Adherence: undefined;
  DoctorPatientList: undefined;
  DoctorPatientDetail: { patientId: string; patientName: string };
};
```

- [ ] **Step 5: Verify the project still type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors. `RegisterScreen.tsx`'s existing 3-argument `register(email, password, name)` call still compiles because `role` now defaults to `'patient'`.

- [ ] **Step 6: Run the mobile test suite**

Run (from `mobile/`): `npm test`
Expected: existing 4 tests (bmi, validators) still pass — this task adds no new pure-function test surface.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/api/auth.ts mobile/src/context/AuthContext.tsx mobile/src/api/doctor.ts mobile/src/navigation/types.ts
git commit -m "feat(mobile): add doctor API wrappers, role-aware register, and auth/me restoration"
```

---

### Task 4: Register screen role picker

**Files:**
- Modify: `mobile/src/screens/RegisterScreen.tsx`

**Interfaces:**
- Consumes: `UserRole` (Task 3), `useAuth().register` (Task 3, now accepts a 4th `role` argument).

- [ ] **Step 1: Replace `mobile/src/screens/RegisterScreen.tsx`**

Current file (for reference):

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister() {
    setSubmitting(true);
    try {
      await register(email, password, name);
    } catch (err) {
      Alert.alert('注册失败', '请检查填写内容后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>注册</Text>
      <TextInput style={styles.input} placeholder="姓名" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="邮箱"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput style={styles.input} placeholder="密码" secureTextEntry value={password} onChangeText={setPassword} />
      <Button title={submitting ? '注册中...' : '注册'} onPress={handleRegister} disabled={submitting} />
      <Button title="已有账号？去登录" onPress={() => navigation.navigate('Login')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
});
```

Replace the whole file with:

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../api/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'patient', label: '患者' },
  { value: 'doctor', label: '医生' },
];

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister() {
    setSubmitting(true);
    try {
      await register(email, password, name, role);
    } catch (err) {
      Alert.alert('注册失败', '请检查填写内容后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>注册</Text>
      <View style={styles.chipRow}>
        {ROLES.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[styles.chip, role === r.value && styles.chipSelected]}
            onPress={() => setRole(r.value)}
          >
            <Text style={[styles.chipText, role === r.value && styles.chipTextSelected]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput style={styles.input} placeholder="姓名" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="邮箱"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput style={styles.input} placeholder="密码" secureTextEntry value={password} onChangeText={setPassword} />
      <Button title={submitting ? '注册中...' : '注册'} onPress={handleRegister} disabled={submitting} />
      <Button title="已有账号？去登录" onPress={() => navigation.navigate('Login')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  chipRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 16 },
  chipSelected: { backgroundColor: '#3498db', borderColor: '#3498db' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff' },
});
```

- [ ] **Step 2: Verify the project still type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/RegisterScreen.tsx
git commit -m "feat(mobile): add patient/doctor role picker to registration"
```

---

### Task 5: Doctor patient list screen

**Files:**
- Create: `mobile/src/screens/DoctorPatientListScreen.tsx`

**Interfaces:**
- Consumes: `RootStackParamList` (Task 3), `getPatients`/`PatientSummary` (Task 3), `useAuth().logout`.
- Produces: default-exported `DoctorPatientListScreen`, wired into the navigator in Task 7.

- [ ] **Step 1: Create `mobile/src/screens/DoctorPatientListScreen.tsx`**

```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getPatients, PatientSummary } from '../api/doctor';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'DoctorPatientList'>;

export default function DoctorPatientListScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [allPatients, setAllPatients] = useState<PatientSummary[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getPatients()
        .then((data) => {
          setAllPatients(data);
          setPatients(data);
          const unique = Array.from(new Set(data.flatMap((p) => p.chronicConditions)));
          setConditions(unique);
          setSelectedCondition(null);
        })
        .finally(() => setLoading(false));
    }, [])
  );

  async function handleSelectCondition(condition: string | null) {
    setSelectedCondition(condition);
    if (condition === null) {
      setPatients(allPatients);
      return;
    }
    setLoading(true);
    try {
      const data = await getPatients(condition);
      setPatients(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.chip, selectedCondition === null && styles.chipSelected]}
          onPress={() => handleSelectCondition(null)}
        >
          <Text style={[styles.chipText, selectedCondition === null && styles.chipTextSelected]}>全部</Text>
        </TouchableOpacity>
        {conditions.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, selectedCondition === c && styles.chipSelected]}
            onPress={() => handleSelectCondition(c)}
          >
            <Text style={[styles.chipText, selectedCondition === c && styles.chipTextSelected]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>暂无患者</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                navigation.navigate('DoctorPatientDetail', { patientId: item.id, patientName: item.name })
              }
            >
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowSubtitle}>
                {item.age != null ? `${item.age}岁` : '年龄未知'} · {item.chronicConditions.join('、') || '无慢病记录'}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
      <Button title="退出登录" color="#c0392b" onPress={() => logout()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipSelected: { backgroundColor: '#3498db', borderColor: '#3498db' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff' },
  list: { padding: 16 },
  row: { borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 12 },
  rowTitle: { fontWeight: 'bold', fontSize: 16 },
  rowSubtitle: { color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 32, color: '#888' },
});
```

- [ ] **Step 2: Verify the project still type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/DoctorPatientListScreen.tsx
git commit -m "feat(mobile): add doctor patient list screen with chronic-condition filter"
```

---

### Task 6: Doctor patient detail screen

**Files:**
- Create: `mobile/src/screens/DoctorPatientDetailScreen.tsx`

**Interfaces:**
- Consumes: `RootStackParamList` (Task 3), `getPatientProfile`/`getPatientAdherence`/`getPatientRecords`/`PatientProfile`/`PatientRecord`/`PatientAdherence` (Task 3).
- Produces: default-exported `DoctorPatientDetailScreen`, wired into the navigator in Task 7.

- [ ] **Step 1: Create `mobile/src/screens/DoctorPatientDetailScreen.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, ScrollView, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  getPatientProfile,
  getPatientRecords,
  getPatientAdherence,
  PatientProfile,
  PatientRecord,
  PatientAdherence,
} from '../api/doctor';

type Props = NativeStackScreenProps<RootStackParamList, 'DoctorPatientDetail'>;

type Metric = 'bloodPressure' | 'bloodGlucose' | 'weightKg';

export default function DoctorPatientDetailScreen({ route }: Props) {
  const { patientId, patientName } = route.params;
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [adherence, setAdherence] = useState<PatientAdherence | null>(null);
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>('bloodPressure');

  useEffect(() => {
    Promise.all([
      getPatientProfile(patientId).catch(() => null),
      getPatientAdherence(patientId).catch(() => null),
      getPatientRecords(patientId, 90).catch(() => []),
    ]).then(([profileData, adherenceData, recordsData]) => {
      setProfile(profileData);
      setAdherence(adherenceData);
      setRecords(recordsData);
      setLoading(false);
    });
  }, [patientId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const filteredRecords =
    metric === 'bloodPressure'
      ? records.filter((r) => r.systolic != null && r.diastolic != null)
      : metric === 'bloodGlucose'
      ? records.filter((r) => r.bloodGlucose != null)
      : records.filter((r) => r.weightKg != null);

  const labels = filteredRecords.map((r) => r.recordDate.slice(5, 10));

  const datasets =
    metric === 'bloodPressure'
      ? [
          { data: filteredRecords.map((r) => r.systolic ?? 0), color: () => '#e74c3c' },
          { data: filteredRecords.map((r) => r.diastolic ?? 0), color: () => '#3498db' },
        ]
      : metric === 'bloodGlucose'
      ? [{ data: filteredRecords.map((r) => r.bloodGlucose ?? 0), color: () => '#2ecc71' }]
      : [{ data: filteredRecords.map((r) => r.weightKg ?? 0), color: () => '#9b59b6' }];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{patientName}</Text>

      {profile && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>健康档案</Text>
          <Text>
            年龄: {profile.age}　性别: {profile.gender}
          </Text>
          <Text>
            身高: {profile.heightCm}cm　体重: {profile.weightKg}kg　BMI: {profile.bmi}
          </Text>
          <Text>慢病类型: {profile.chronicConditions.join('、') || '无'}</Text>
          <Text>正在服用药物: {profile.medications.join('、') || '无'}</Text>
          <Text>过敏史: {profile.allergies || '无'}</Text>
        </View>
      )}

      {adherence && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>依从性(最近30天)</Text>
          <Text>
            完成率: {Math.round(adherence.completionRate * 100)}%　连续记录: {adherence.currentStreak}天　漏记:{' '}
            {adherence.missedDays}天
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>90天趋势图</Text>
        <View style={styles.buttons}>
          <Button title="血压" onPress={() => setMetric('bloodPressure')} />
          <Button title="血糖" onPress={() => setMetric('bloodGlucose')} />
          <Button title="体重" onPress={() => setMetric('weightKg')} />
        </View>
        {filteredRecords.length === 0 ? (
          <Text style={styles.empty}>暂无数据</Text>
        ) : (
          <LineChart
            data={{ labels, datasets }}
            width={Dimensions.get('window').width - 32}
            height={240}
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 1,
              color: () => '#333',
              labelColor: () => '#333',
            }}
            bezier
            style={{ borderRadius: 8 }}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, marginBottom: 16 },
  cardTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 8 },
  buttons: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  empty: { textAlign: 'center', marginTop: 16, color: '#888' },
});
```

- [ ] **Step 2: Verify the project still type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/DoctorPatientDetailScreen.tsx
git commit -m "feat(mobile): add doctor patient detail screen with profile, adherence, and 90-day trends"
```

---

### Task 7: Role-based navigator wiring

**Files:**
- Modify: `mobile/src/navigation/AppNavigator.tsx`

**Interfaces:**
- Consumes: `DoctorPatientListScreen` (Task 5), `DoctorPatientDetailScreen` (Task 6), `user` from `useAuth()` (Task 3, now populated on cold start via `GET /auth/me`).
- Produces: the fully role-aware navigator — final deliverable of Phase 3.

- [ ] **Step 1: Replace `mobile/src/navigation/AppNavigator.tsx`**

Current file (for reference):

```tsx
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from './types';
import { navigationRef, navigateToDailyRecord } from './navigationRef';
import { getReminders } from '../api/reminders';
import { scheduleReminderNotifications, cancelReminderNotifications } from '../utils/notifications';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import HomeScreen from '../screens/HomeScreen';
import DailyRecordScreen from '../screens/DailyRecordScreen';
import HistoryScreen from '../screens/HistoryScreen';
import TrendsScreen from '../screens/TrendsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import ReminderFormScreen from '../screens/ReminderFormScreen';
import AdherenceScreen from '../screens/AdherenceScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { token, isLoading } = useAuth();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      navigateToDailyRecord();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!token) return;
    getReminders()
      .then((reminders) => {
        reminders.forEach((reminder) => {
          if (reminder.enabled) {
            scheduleReminderNotifications(reminder).catch(() => {});
          } else {
            cancelReminderNotifications(reminder.id).catch(() => {});
          }
        });
      })
      .catch(() => {});
  }, [token]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator>
        {token ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: '首页' }} />
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} options={{ title: '健康档案' }} />
            <Stack.Screen name="DailyRecord" component={DailyRecordScreen} options={{ title: '今日记录' }} />
            <Stack.Screen name="History" component={HistoryScreen} options={{ title: '历史记录' }} />
            <Stack.Screen name="Trends" component={TrendsScreen} options={{ title: '趋势图' }} />
            <Stack.Screen name="Reminders" component={RemindersScreen} options={{ title: '健康提醒' }} />
            <Stack.Screen name="ReminderForm" component={ReminderFormScreen} options={{ title: '编辑提醒' }} />
            <Stack.Screen name="Adherence" component={AdherenceScreen} options={{ title: '依从性分析' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: '登录' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: '注册' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

Replace the whole file with:

```tsx
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from './types';
import { navigationRef, navigateToDailyRecord } from './navigationRef';
import { getReminders } from '../api/reminders';
import { scheduleReminderNotifications, cancelReminderNotifications } from '../utils/notifications';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import HomeScreen from '../screens/HomeScreen';
import DailyRecordScreen from '../screens/DailyRecordScreen';
import HistoryScreen from '../screens/HistoryScreen';
import TrendsScreen from '../screens/TrendsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import ReminderFormScreen from '../screens/ReminderFormScreen';
import AdherenceScreen from '../screens/AdherenceScreen';
import DoctorPatientListScreen from '../screens/DoctorPatientListScreen';
import DoctorPatientDetailScreen from '../screens/DoctorPatientDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { token, isLoading, user } = useAuth();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      navigateToDailyRecord();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!token || user?.role !== 'patient') return;
    getReminders()
      .then((reminders) => {
        reminders.forEach((reminder) => {
          if (reminder.enabled) {
            scheduleReminderNotifications(reminder).catch(() => {});
          } else {
            cancelReminderNotifications(reminder.id).catch(() => {});
          }
        });
      })
      .catch(() => {});
  }, [token, user]);

  if (isLoading || (token && !user)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator>
        {token && user?.role === 'doctor' ? (
          <>
            <Stack.Screen name="DoctorPatientList" component={DoctorPatientListScreen} options={{ title: '患者列表' }} />
            <Stack.Screen
              name="DoctorPatientDetail"
              component={DoctorPatientDetailScreen}
              options={{ title: '患者详情' }}
            />
          </>
        ) : token ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: '首页' }} />
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} options={{ title: '健康档案' }} />
            <Stack.Screen name="DailyRecord" component={DailyRecordScreen} options={{ title: '今日记录' }} />
            <Stack.Screen name="History" component={HistoryScreen} options={{ title: '历史记录' }} />
            <Stack.Screen name="Trends" component={TrendsScreen} options={{ title: '趋势图' }} />
            <Stack.Screen name="Reminders" component={RemindersScreen} options={{ title: '健康提醒' }} />
            <Stack.Screen name="ReminderForm" component={ReminderFormScreen} options={{ title: '编辑提醒' }} />
            <Stack.Screen name="Adherence" component={AdherenceScreen} options={{ title: '依从性分析' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: '登录' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: '注册' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

Note the added `token && !user` branch in the loading check (Step 1's loading condition): without it, there is a brief window right after a cold start with a stored token — before `GET /auth/me` resolves — where `token` is truthy but `user` is still `null`. Since the doctor/patient branch below tests `user?.role`, that window would render the **patient** stack for a doctor account until `/auth/me` resolves and the component re-renders with the doctor stack, causing a visible flash and a React Navigation warning when the screen set changes underneath an active navigator. Waiting for `user` to be present whenever `token` is present avoids that.

- [ ] **Step 2: Verify the whole mobile project type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full mobile test suite**

Run (from `mobile/`): `npm test`
Expected: 4/4 tests still pass (bmi, validators — unchanged).

- [ ] **Step 4: Manually verify on a real device**

This requires the backend running against a migrated database (no new migration needed this phase — no schema changes) and Expo Go on a phone:

1. Register a new account, this time selecting "医生" on the registration screen.
2. Confirm you land directly on a patient list screen (no health-profile-setup step — that's patient-only) — should be empty or show whatever patients already exist from your Phase 1/2 testing.
3. Log out, log back in as your existing patient test account — confirm you land on the normal patient Home screen, unaffected by this phase's changes.
4. Log back in as the doctor account. If you have at least one patient account with a completed health profile and some daily records, tap into it — confirm the health profile, adherence numbers, and 90-day trend chart (with metric switching) all render.
5. Try the chronic-condition filter chips on the patient list — confirm selecting one narrows the list, and "全部" restores it.
6. Force-quit and reopen the app while still logged in as the doctor — confirm it goes straight back to the doctor patient list (not a flash of the patient Home screen, not a crash) — this exercises the cold-start `GET /auth/me` role restoration from Step 1.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/navigation/AppNavigator.tsx
git commit -m "feat(mobile): branch navigation by role between patient and doctor stacks"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Role-aware registration + `GET /auth/me` → Task 1. Doctor-only read routes (patients list with condition filter, profile, 90-day records, adherence) → Task 2. Mobile API layer + navigation scaffolding + cold-start role restoration → Task 3. Registration role picker → Task 4. Patient list + filter UI → Task 5. Patient detail (profile + adherence + 90-day trend) → Task 6. Role-based navigator split → Task 7.
- **Type consistency:** `UserRole` (Task 3) is used identically by `AuthContext.register` (Task 3) and `RegisterScreen` (Task 4). `PatientSummary`/`PatientProfile`/`PatientRecord`/`PatientAdherence` (Task 3) are consumed with matching field names by `DoctorPatientListScreen` (Task 5) and `DoctorPatientDetailScreen` (Task 6) — verified against `backend/src/routes/doctor.ts`'s actual response shapes from Task 2. `RootStackParamList`'s `DoctorPatientDetail: { patientId: string; patientName: string }` (Task 3) matches both the navigation call site in Task 5 and the `route.params` destructuring in Task 6.
- **No placeholders:** all steps contain complete, runnable code; no TODOs.
- **Cross-task risk called out explicitly:** Task 3's backward-compatible `role` default (so Task 4 isn't required to land in the same commit) and Task 7's `token && !user` loading guard (to avoid a role-restoration race) are both flagged inline with the reasoning, not left implicit.
