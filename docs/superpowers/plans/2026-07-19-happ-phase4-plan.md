# HAPP Phase 4 Implementation Plan — Admin Usage Analytics

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add module 8 (backend usage analytics) to HAPP — a read-only admin dashboard showing patient continuous-usage streak counts, 30-day average daily active users, and a 30-day top-features ranking, driven by a single navigation-level usage event log.

**Architecture:** Builds on the Phase 1-3 monorepo (`backend/` Express+Prisma, `mobile/` Expo+React Navigation). One new table (`UsageEvent`) logs every screen navigation for authenticated users via a single `onStateChange` hook on `NavigationContainer` — no per-screen instrumentation. Stats are computed on demand from that log (no cached/pre-aggregated tables), gated behind a new `role === 'admin'` branch in the navigator, mirroring the doctor stack's pattern from Phase 3.

**Tech Stack:** Same as Phase 1-3, no new dependencies.

## Global Constraints

- TypeScript `strict: true` in both packages.
- `UsageEvent` has no unique constraint — multiple events per user per day per screen are expected and not deduplicated at write time.
- Usage events are logged only when `token` is present (never for Login/Register, which happen pre-auth) — this also means Login/Register never appear in the top-features ranking.
- "Continuous usage streak" for a user uses the same algorithm as Phase 2's adherence streak: walk backward from today; if today has no event, start from yesterday instead; if both today and yesterday have no event, streak is 0. `days90`/`days60`/`days30` counts are cumulative (a user with a 100-day streak counts toward all three).
- Continuous-usage and average-daily-active-user stats only count `role === 'patient'` users. Top-features ranking counts events from all roles.
- Average daily active users is computed over a fixed 30-day window (today plus the preceding 29 days), including zero-activity days in the average (divide by 30, not by the count of days with data), rounded to 1 decimal place.
- Top features: 30-day window, all roles, top 10 by event count, descending.
- No admin self-registration — `POST /auth/register`'s role validation (`['patient', 'doctor']`, Phase 3) is unchanged; admin accounts are created by manually editing a user's `role` in the database.
- Commit after every task.

---

### Task 1: Prisma schema — UsageEvent model

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/tests/db.test.ts`

**Interfaces:**
- Produces: `UsageEvent` model (`id, userId, user, screen, createdAt`) and a `usageEvents UsageEvent[]` back-relation on `User` — consumed by Tasks 3 and 4 via `prisma.usageEvent`.

- [ ] **Step 1: Replace `backend/prisma/schema.prisma` with the following (adds `usageEvents` to `User` and the `UsageEvent` model; everything else is unchanged from Phase 3)**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  patient
  doctor
  admin
}

enum ReminderType {
  blood_pressure
  medication
  exercise
  blood_glucose
  custom
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role     @default(patient)
  createdAt    DateTime @default(now())

  healthProfile HealthProfile?
  dailyRecords  DailyRecord[]
  reminders     Reminder[]
  usageEvents   UsageEvent[]
}

model HealthProfile {
  id                String   @id @default(uuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])
  age               Int
  gender            String
  heightCm          Float
  weightKg          Float
  chronicConditions String[]
  medications       String[]
  allergies         String?
  updatedAt         DateTime @updatedAt
}

model DailyRecord {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  recordDate      DateTime @db.Date
  systolic        Int?
  diastolic       Int?
  bloodGlucose    Float?
  heartRate       Int?
  weightKg        Float?
  sleepHours      Float?
  exerciseMinutes Int?
  waterMl         Int?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, recordDate])
}

model Reminder {
  id        String       @id @default(uuid())
  userId    String
  user      User         @relation(fields: [userId], references: [id])
  type      ReminderType
  title     String
  time      String
  weekdays  Int[]
  enabled   Boolean      @default(true)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
}

model UsageEvent {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  screen    String
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Run the migration**

Run (from `backend/`): `npx prisma migrate dev --name add_usage_events`
Expected: `Applying migration` + `Generated Prisma Client` messages. Requires a reachable PostgreSQL database.

- [ ] **Step 3: Extend the model-delegate test**

Replace `backend/tests/db.test.ts` with:

```ts
import { prisma } from '../src/db';

describe('prisma client', () => {
  it('exposes model delegates for User, HealthProfile, DailyRecord, Reminder, UsageEvent', () => {
    expect(typeof prisma.user.create).toBe('function');
    expect(typeof prisma.healthProfile.upsert).toBe('function');
    expect(typeof prisma.dailyRecord.upsert).toBe('function');
    expect(typeof prisma.reminder.create).toBe('function');
    expect(typeof prisma.usageEvent.create).toBe('function');
  });
});
```

- [ ] **Step 4: Run tests and verify pass**

Run: `npx jest tests/db.test.ts --verbose`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/tests/db.test.ts backend/prisma/migrations
git commit -m "feat(backend): add UsageEvent model to Prisma schema"
```

---

### Task 2: Usage statistics calculation (pure functions)

**Files:**
- Create: `backend/src/utils/usageStats.ts`
- Create: `backend/tests/usageStats.test.ts`

**Interfaces:**
- Produces: `ContinuousUsersResult` (`{ days90: number; days60: number; days30: number }`), `TopFeature` (`{ screen: string; count: number }`), `calculateContinuousUsers(events: { userId: string; date: Date }[], todayKey: string): ContinuousUsersResult`, `calculateAvgDailyActiveUsers(events: { userId: string; date: Date }[], todayKey: string): number`, `calculateTopFeatures(events: { screen: string }[], limit?: number): TopFeature[]` — used by Task 4's route.

- [ ] **Step 1: Write the failing tests**

`backend/tests/usageStats.test.ts`:

```ts
import { calculateContinuousUsers, calculateAvgDailyActiveUsers, calculateTopFeatures } from '../src/utils/usageStats';

function dateNDaysBefore(base: string, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describe('calculateContinuousUsers', () => {
  const today = '2026-07-19';

  it('returns all zeros when there are no events', () => {
    expect(calculateContinuousUsers([], today)).toEqual({ days90: 0, days60: 0, days30: 0 });
  });

  it('counts a user with a 90-day streak in all three buckets', () => {
    const events = Array.from({ length: 90 }, (_, i) => ({ userId: 'u1', date: dateNDaysBefore(today, i) }));
    expect(calculateContinuousUsers(events, today)).toEqual({ days90: 1, days60: 1, days30: 1 });
  });

  it('counts a user with a 40-day streak only in the 30-day bucket', () => {
    const events = Array.from({ length: 40 }, (_, i) => ({ userId: 'u1', date: dateNDaysBefore(today, i) }));
    expect(calculateContinuousUsers(events, today)).toEqual({ days90: 0, days60: 0, days30: 1 });
  });

  it('counts multiple users independently, ignoring a non-consecutive event', () => {
    const events = [
      ...Array.from({ length: 90 }, (_, i) => ({ userId: 'u1', date: dateNDaysBefore(today, i) })),
      ...Array.from({ length: 30 }, (_, i) => ({ userId: 'u2', date: dateNDaysBefore(today, i) })),
      { userId: 'u3', date: dateNDaysBefore(today, 5) },
    ];
    expect(calculateContinuousUsers(events, today)).toEqual({ days90: 1, days60: 1, days30: 2 });
  });
});

describe('calculateAvgDailyActiveUsers', () => {
  const today = '2026-07-19';

  it('returns 0 when there are no events', () => {
    expect(calculateAvgDailyActiveUsers([], today)).toBe(0);
  });

  it('averages distinct daily users over the full 30-day window, including zero-activity days', () => {
    const events = [
      { userId: 'u1', date: dateNDaysBefore(today, 0) },
      { userId: 'u2', date: dateNDaysBefore(today, 0) },
    ];
    expect(calculateAvgDailyActiveUsers(events, today)).toBe(0.1);
  });

  it('does not double-count the same user active multiple times in one day', () => {
    const events = [
      { userId: 'u1', date: dateNDaysBefore(today, 0) },
      { userId: 'u1', date: dateNDaysBefore(today, 0) },
    ];
    expect(calculateAvgDailyActiveUsers(events, today)).toBe(Math.round((1 / 30) * 10) / 10);
  });
});

describe('calculateTopFeatures', () => {
  it('returns an empty array when there are no events', () => {
    expect(calculateTopFeatures([])).toEqual([]);
  });

  it('ranks screens by descending count', () => {
    const events = [
      { screen: 'Home' },
      { screen: 'Home' },
      { screen: 'Home' },
      { screen: 'Trends' },
      { screen: 'Trends' },
      { screen: 'DailyRecord' },
    ];
    expect(calculateTopFeatures(events)).toEqual([
      { screen: 'Home', count: 3 },
      { screen: 'Trends', count: 2 },
      { screen: 'DailyRecord', count: 1 },
    ]);
  });

  it('limits results to the given limit', () => {
    const events = Array.from({ length: 15 }, (_, i) => ({ screen: `Screen${i}` }));
    expect(calculateTopFeatures(events, 10)).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/usageStats.test.ts`
Expected: FAIL with "Cannot find module '../src/utils/usageStats'".

- [ ] **Step 3: Implement `backend/src/utils/usageStats.ts`**

```ts
export interface ContinuousUsersResult {
  days90: number;
  days60: number;
  days30: number;
}

export interface TopFeature {
  screen: string;
  count: number;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function calculateStreak(activeDays: Set<string>, todayKey: string): number {
  let streak = 0;
  let offset = activeDays.has(todayKey) ? 0 : 1;
  while (activeDays.has(addDays(todayKey, -offset))) {
    streak++;
    offset++;
  }
  return streak;
}

export function calculateContinuousUsers(
  events: { userId: string; date: Date }[],
  todayKey: string
): ContinuousUsersResult {
  const byUser = new Map<string, Set<string>>();
  for (const e of events) {
    const key = toDateKey(e.date);
    if (!byUser.has(e.userId)) byUser.set(e.userId, new Set());
    byUser.get(e.userId)!.add(key);
  }

  let days90 = 0;
  let days60 = 0;
  let days30 = 0;

  for (const activeDays of byUser.values()) {
    const streak = calculateStreak(activeDays, todayKey);
    if (streak >= 90) days90++;
    if (streak >= 60) days60++;
    if (streak >= 30) days30++;
  }

  return { days90, days60, days30 };
}

export function calculateAvgDailyActiveUsers(events: { userId: string; date: Date }[], todayKey: string): number {
  const byDay = new Map<string, Set<string>>();
  for (let i = 0; i < 30; i++) {
    byDay.set(addDays(todayKey, -i), new Set());
  }

  for (const e of events) {
    const key = toDateKey(e.date);
    const set = byDay.get(key);
    if (set) set.add(e.userId);
  }

  let total = 0;
  for (const set of byDay.values()) {
    total += set.size;
  }

  return Math.round((total / 30) * 10) / 10;
}

export function calculateTopFeatures(events: { screen: string }[], limit = 10): TopFeature[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    counts.set(e.screen, (counts.get(e.screen) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([screen, count]) => ({ screen, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/usageStats.test.ts`
Expected: PASS, 10 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/usageStats.ts backend/tests/usageStats.test.ts
git commit -m "feat(backend): add usage statistics calculation utilities"
```

---

### Task 3: Usage event logging route

**Files:**
- Create: `backend/src/routes/usageEvents.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/usageEvents.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 1), `requireAuth`/`AuthRequest` from `../middleware/auth`, `asyncHandler`.
- Produces: `usageEventsRouter` mounted at `/usage-events` — `POST /` (any authenticated role, 201 on success, 400 if `screen` is missing/empty).

- [ ] **Step 1: Create `backend/src/routes/usageEvents.ts`**

```ts
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
import { doctorRouter } from './routes/doctor';

export const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRouter);
app.use('/profile', profileRouter);
app.use('/records', recordsRouter);
app.use('/reminders', remindersRouter);
app.use('/adherence', adherenceRouter);
app.use('/doctor', doctorRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
```

Add the import after the `doctorRouter` import:

```ts
import { usageEventsRouter } from './routes/usageEvents';
```

Add the mount after `app.use('/doctor', doctorRouter);` (before `/health` and the error-handling middleware, which must remain last):

```ts
app.use('/usage-events', usageEventsRouter);
```

- [ ] **Step 3: Write the failing tests**

`backend/tests/usageEvents.test.ts`:

```ts
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    usageEvent: {
      create: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  usageEvent: { create: jest.Mock };
};

function authHeader(userId = 'user-1', role = 'patient') {
  const token = jwt.sign({ userId, role }, process.env.JWT_SECRET || 'dev-secret');
  return `Bearer ${token}`;
}

describe('POST /usage-events', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/usage-events').send({ screen: 'Home' });
    expect(res.status).toBe(401);
  });

  it('rejects a missing screen with 400', async () => {
    const res = await request(app).post('/usage-events').set('Authorization', authHeader()).send({});
    expect(res.status).toBe(400);
  });

  it('rejects an empty screen with 400', async () => {
    const res = await request(app).post('/usage-events').set('Authorization', authHeader()).send({ screen: '  ' });
    expect(res.status).toBe(400);
  });

  it('creates a usage event for any authenticated role and returns 201', async () => {
    mockedPrisma.usageEvent.create.mockResolvedValue({ id: 'e1', userId: 'user-1', screen: 'Home' });

    const res = await request(app)
      .post('/usage-events')
      .set('Authorization', authHeader('doctor-1', 'doctor'))
      .send({ screen: 'DoctorPatientList' });

    expect(res.status).toBe(201);
    expect(mockedPrisma.usageEvent.create).toHaveBeenCalledWith({
      data: { userId: 'doctor-1', screen: 'DoctorPatientList' },
    });
  });
});
```

- [ ] **Step 4: Run tests and verify pass**

Run: `npx jest tests/usageEvents.test.ts`
Expected: PASS, 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/usageEvents.ts backend/src/app.ts backend/tests/usageEvents.test.ts
git commit -m "feat(backend): add usage event logging route"
```

---

### Task 4: Admin stats route

**Files:**
- Create: `backend/src/routes/admin.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/admin.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 1), `requireAuth`/`requireRole` from `../middleware/auth` (Phase 3), `asyncHandler`, `calculateContinuousUsers`/`calculateAvgDailyActiveUsers`/`calculateTopFeatures` (Task 2).
- Produces: `adminRouter` mounted at `/admin` — `GET /stats` (requires `role === 'admin'`) returns `{ continuousUsers: ContinuousUsersResult, avgDailyActiveUsers: number, topFeatures: TopFeature[] }`.

- [ ] **Step 1: Create `backend/src/routes/admin.ts`**

```ts
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
```

- [ ] **Step 2: Mount the router in `backend/src/app.ts`**

Add import after the `usageEventsRouter` import:

```ts
import { adminRouter } from './routes/admin';
```

Add mount after `app.use('/usage-events', usageEventsRouter);`:

```ts
app.use('/admin', adminRouter);
```

- [ ] **Step 3: Write the failing tests**

`backend/tests/admin.test.ts`:

```ts
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    usageEvent: {
      findMany: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  usageEvent: { findMany: jest.Mock };
};

function authHeader(userId = 'admin-1', role = 'admin') {
  const token = jwt.sign({ userId, role }, process.env.JWT_SECRET || 'dev-secret');
  return `Bearer ${token}`;
}

describe('GET /admin/stats', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/admin/stats');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin role', async () => {
    const res = await request(app).get('/admin/stats').set('Authorization', authHeader('patient-1', 'patient'));
    expect(res.status).toBe(403);
  });

  it('returns computed stats for an admin', async () => {
    mockedPrisma.usageEvent.findMany
      .mockResolvedValueOnce([{ userId: 'p1', createdAt: new Date() }])
      .mockResolvedValueOnce([{ screen: 'Home' }, { screen: 'Home' }, { screen: 'Trends' }]);

    const res = await request(app).get('/admin/stats').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    // Only 1 day of activity for p1 — a streak of 1 doesn't clear any of the
    // 90/60/30 thresholds, so all three counts are 0. calculateContinuousUsers's
    // own threshold logic is already covered exhaustively in Task 2's tests;
    // this test only checks that the route wires Prisma's result into it.
    expect(res.body.continuousUsers).toEqual({ days90: 0, days60: 0, days30: 0 });
    expect(res.body.avgDailyActiveUsers).toBe(Math.round((1 / 30) * 10) / 10);
    expect(res.body.topFeatures).toEqual([
      { screen: 'Home', count: 2 },
      { screen: 'Trends', count: 1 },
    ]);
  });

  it('queries patient-only events scoped to role and a 90-day window', async () => {
    mockedPrisma.usageEvent.findMany.mockResolvedValue([]);

    await request(app).get('/admin/stats').set('Authorization', authHeader());

    expect(mockedPrisma.usageEvent.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ user: { role: 'patient' } }),
      })
    );
  });
});
```

- [ ] **Step 4: Run tests and verify pass**

Run: `npx jest tests/admin.test.ts`
Expected: PASS, 4 passed.

- [ ] **Step 5: Run the full backend suite**

Run: `npm test`
Expected: all backend test files pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/admin.ts backend/src/app.ts backend/tests/admin.test.ts
git commit -m "feat(backend): add admin usage statistics route"
```

---

### Task 5: Mobile API wrappers + navigation types

**Files:**
- Create: `mobile/src/api/usage.ts`
- Create: `mobile/src/api/admin.ts`
- Modify: `mobile/src/navigation/types.ts`

**Interfaces:**
- Produces: `logUsageEvent(screen: string): Promise<void>` (never rejects — swallows its own errors) from `mobile/src/api/usage.ts`; `ContinuousUsers`/`TopFeature`/`AdminStats` types + `getAdminStats(): Promise<AdminStats>` from `mobile/src/api/admin.ts`; `RootStackParamList` gains `AdminStats: undefined` — used by Tasks 6-7.

- [ ] **Step 1: Create `mobile/src/api/usage.ts`**

```ts
import { apiClient } from './client';

export async function logUsageEvent(screen: string): Promise<void> {
  try {
    await apiClient.post('/usage-events', { screen });
  } catch {
    // best-effort analytics ping; never block or surface errors to the user
  }
}
```

- [ ] **Step 2: Create `mobile/src/api/admin.ts`**

```ts
import { apiClient } from './client';

export interface ContinuousUsers {
  days90: number;
  days60: number;
  days30: number;
}

export interface TopFeature {
  screen: string;
  count: number;
}

export interface AdminStats {
  continuousUsers: ContinuousUsers;
  avgDailyActiveUsers: number;
  topFeatures: TopFeature[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const res = await apiClient.get<AdminStats>('/admin/stats');
  return res.data;
}
```

- [ ] **Step 3: Replace `mobile/src/navigation/types.ts`**

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
  AdminStats: undefined;
};
```

- [ ] **Step 4: Verify the project still type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the mobile test suite**

Run (from `mobile/`): `npm test`
Expected: existing 4 tests (bmi, validators) still pass — this task adds no new pure-function test surface.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/api/usage.ts mobile/src/api/admin.ts mobile/src/navigation/types.ts
git commit -m "feat(mobile): add usage event and admin stats API wrappers"
```

---

### Task 6: Admin stats screen

**Files:**
- Create: `mobile/src/screens/AdminStatsScreen.tsx`

**Interfaces:**
- Consumes: `RootStackParamList` (Task 5, no navigation props needed — no params for this route), `getAdminStats`/`AdminStats` (Task 5), `useAuth().logout`.
- Produces: default-exported `AdminStatsScreen`, wired into the navigator in Task 7.

- [ ] **Step 1: Create `mobile/src/screens/AdminStatsScreen.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Button } from 'react-native';
import { getAdminStats, AdminStats } from '../api/admin';
import { useAuth } from '../context/AuthContext';

const SCREEN_LABELS: Record<string, string> = {
  Home: '首页',
  ProfileSetup: '健康档案',
  DailyRecord: '今日记录',
  History: '历史记录',
  Trends: '趋势图',
  Reminders: '健康提醒',
  ReminderForm: '编辑提醒',
  Adherence: '依从性分析',
  DoctorPatientList: '患者列表',
  DoctorPatientDetail: '患者详情',
  AdminStats: '后台统计',
};

function labelFor(screen: string): string {
  return SCREEN_LABELS[screen] ?? screen;
}

export default function AdminStatsScreen() {
  const { logout } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>加载失败，请稍后重试</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>连续使用人数</Text>
        <View style={styles.row}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.continuousUsers.days90}</Text>
            <Text style={styles.label}>≥90天</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.continuousUsers.days60}</Text>
            <Text style={styles.label}>≥60天</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.continuousUsers.days30}</Text>
            <Text style={styles.label}>≥30天</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>日均使用人数(最近30天)</Text>
        <Text style={styles.bigNumber}>{stats.avgDailyActiveUsers}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>功能使用排行(最近30天)</Text>
        {stats.topFeatures.length === 0 ? (
          <Text style={styles.empty}>暂无数据</Text>
        ) : (
          stats.topFeatures.map((f, i) => (
            <Text key={f.screen} style={styles.featureRow}>
              {i + 1}. {labelFor(f.screen)} — {f.count}次
            </Text>
          ))
        )}
      </View>

      <Button title="退出登录" color="#c0392b" onPress={() => logout()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, marginBottom: 16 },
  cardTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: 28, fontWeight: 'bold' },
  bigNumber: { fontSize: 40, fontWeight: 'bold', color: '#3498db', textAlign: 'center' },
  label: { color: '#666', marginTop: 4 },
  featureRow: { fontSize: 14, marginBottom: 6 },
  empty: { textAlign: 'center', marginTop: 16, color: '#888' },
});
```

- [ ] **Step 2: Verify the project still type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/AdminStatsScreen.tsx
git commit -m "feat(mobile): add admin usage statistics screen"
```

---

### Task 7: Navigation-level usage logging + admin navigator branch

**Files:**
- Modify: `mobile/src/navigation/AppNavigator.tsx`

**Interfaces:**
- Consumes: `AdminStatsScreen` (Task 6), `logUsageEvent` (Task 5), `navigationRef` (Phase 2, already exported from `mobile/src/navigation/navigationRef.ts`).
- Produces: the fully wired Phase 4 app — final deliverable.

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
import { logUsageEvent } from '../api/usage';
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
import AdminStatsScreen from '../screens/AdminStatsScreen';

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
    <NavigationContainer
      ref={navigationRef}
      onStateChange={() => {
        if (!token) return;
        const routeName = navigationRef.getCurrentRoute()?.name;
        if (routeName) {
          logUsageEvent(routeName);
        }
      }}
    >
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
        ) : token && user?.role === 'admin' ? (
          <Stack.Screen name="AdminStats" component={AdminStatsScreen} options={{ title: '后台统计' }} />
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

Note: `logUsageEvent` (Task 5) already swallows its own errors internally and never rejects, so the `onStateChange` callback does not need its own `try`/`catch` around the call.

- [ ] **Step 2: Verify the whole mobile project type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full mobile test suite**

Run (from `mobile/`): `npm test`
Expected: 4/4 tests still pass (bmi, validators — unchanged).

- [ ] **Step 4: Manually verify on a real device**

This requires the backend running against a migrated database and Expo Go on a phone:

1. In the database, manually set an existing test account's `role` to `admin` (e.g. via `psql` or a GUI client: `UPDATE "User" SET role = 'admin' WHERE email = 'your-test-doctor-or-patient@example.com';`). Use an account you don't need for its previous role anymore, or create a fresh one via the patient registration flow first.
2. Log out of any current session, log back in as that account — confirm you land directly on a "后台统计" screen (no health-profile setup, no patient list).
3. Confirm the three cards render: 连续使用人数 (90/60/30), 日均使用人数, 功能使用排行. On a fresh dataset these will mostly show 0s and an empty or sparse feature ranking — that's expected on first run.
4. Log out, log back in as one of your existing patient test accounts, and click around several screens (今日记录, 历史记录, 趋势图, 健康提醒) to generate some usage events.
5. Log back in as the admin account — confirm "功能使用排行" now shows the screens you just visited, and the counts increased.
6. Confirm patient/doctor accounts are completely unaffected — log in as each and verify their normal screens still work exactly as before.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/navigation/AppNavigator.tsx
git commit -m "feat(mobile): log navigation events and add admin stats navigator branch"
```

---

## Plan Self-Review Notes

- **Spec coverage:** `UsageEvent` model + navigation-level logging → Tasks 1, 7. Continuous-usage/avg-DAU/top-features calculation → Task 2. Event write endpoint → Task 3. Admin read endpoint → Task 4. Mobile API layer + route type → Task 5. Admin dashboard UI → Task 6. Navigator wiring (logging hook + admin branch) → Task 7. No admin self-registration is a "don't touch" constraint, not a task — nothing in this plan adds an admin option to `RegisterScreen`.
- **Type consistency:** `ContinuousUsersResult`/`ContinuousUsers` and `TopFeature` are named identically in shape between `backend/src/utils/usageStats.ts` (Task 2) and `mobile/src/api/admin.ts` (Task 5) — field names (`days90`/`days60`/`days30`, `screen`/`count`) match exactly, verified against `backend/src/routes/admin.ts`'s (Task 4) actual JSON response shape. `AdminStatsScreen` (Task 6) consumes `AdminStats` with the same field names it renders.
- **No placeholders:** all steps contain complete, runnable code; no TODOs.
- **Cross-task risk called out explicitly:** Task 7's note that `logUsageEvent` never rejects (so no `.catch()` needed at the call site) is stated inline rather than left implicit, avoiding a reviewer flagging a missing catch that isn't actually needed.
