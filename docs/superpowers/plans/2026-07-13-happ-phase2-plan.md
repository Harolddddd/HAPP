# HAPP Phase 2 Implementation Plan — Reminders + Adherence Analysis

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add module 3 (health reminders with local push notifications) and module 5 (adherence analysis) to the existing HAPP patient app.

**Architecture:** Builds on the Phase 1 monorepo (`backend/` Express+Prisma, `mobile/` Expo+React Navigation). Reminders are CRUD-backed by a new `Reminder` table but scheduled entirely client-side via `expo-notifications` (no backend push service). Adherence is computed server-side from existing `daily_records`, no new table.

**Tech Stack:** Same as Phase 1, plus `expo-notifications` on the mobile side.

## Global Constraints

- TypeScript `strict: true` in both packages (already configured).
- Reminder `time` field format: `HH:mm`, validated with `/^([01]\d|2[0-3]):[0-5]\d$/`.
- Reminder `weekdays`: array of integers 0–6 (0 = Sunday … 6 = Saturday, matching JS `Date.getDay()`), must be non-empty.
- Reminder `type`: one of `blood_pressure`, `medication`, `exercise`, `blood_glucose`, `custom`. `title` is required only when `type === 'custom'`.
- expo-notifications weekday convention is 1–7 (1 = Sunday), so mobile code converts `expoWeekday = ourWeekday + 1` when scheduling.
- Adherence window: most recent 30 days (including the reference day), matching the trend chart's window.
- "Completed a day" = at least one `daily_records` row exists for that date — no per-field requirement.
- Current streak: count backward from today; if today has no record yet, start counting from yesterday instead (today isn't "missed" until it's over); if both today and yesterday are missing, streak is 0.
- `completionRate` is returned as a fraction rounded to 2 decimals (e.g. `0.87`), not a percentage — the mobile UI multiplies by 100 for display.
- Notification tap always navigates to the `DailyRecord` screen, regardless of reminder type.
- Commit after every task.

---

### Task 1: Prisma schema — Reminder model

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/tests/db.test.ts`

**Interfaces:**
- Produces: `ReminderType` enum (`blood_pressure`, `medication`, `exercise`, `blood_glucose`, `custom`) and `Reminder` model (`id, userId, type, title, time, weekdays: Int[], enabled, createdAt, updatedAt`) — consumed by Tasks 3 and 4 via `prisma.reminder`.

- [ ] **Step 1: Replace `backend/prisma/schema.prisma` with the following (adds the `ReminderType` enum, the `Reminder` model, and a `reminders` back-relation on `User`; everything else is unchanged from Phase 1)**

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
```

- [ ] **Step 2: Run the migration**

Run (from `backend/`): `npx prisma migrate dev --name add_reminders`
Expected: `Applying migration` + `Generated Prisma Client` messages. Requires a reachable local PostgreSQL (same one Phase 1 used) — if unavailable in your environment, run this step later on a machine with the database and skip to Step 3 for now (Step 4's test does not require a live DB connection).

- [ ] **Step 3: Extend the model-delegate test**

Replace `backend/tests/db.test.ts` with:

```ts
import { prisma } from '../src/db';

describe('prisma client', () => {
  it('exposes model delegates for User, HealthProfile, DailyRecord, Reminder', () => {
    expect(typeof prisma.user.create).toBe('function');
    expect(typeof prisma.healthProfile.upsert).toBe('function');
    expect(typeof prisma.dailyRecord.upsert).toBe('function');
    expect(typeof prisma.reminder.create).toBe('function');
  });
});
```

- [ ] **Step 4: Run tests and verify pass**

Run: `npx jest tests/db.test.ts --verbose`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/tests/db.test.ts backend/prisma/migrations
git commit -m "feat(backend): add Reminder model to Prisma schema"
```

---

### Task 2: Adherence calculation (pure function)

**Files:**
- Create: `backend/src/utils/adherence.ts`
- Create: `backend/tests/adherence.test.ts`

**Interfaces:**
- Produces: `AdherenceResult` interface (`completedDays: number, missedDays: number, completionRate: number, currentStreak: number`) and `calculateAdherence(recordDates: Date[], todayKey: string): AdherenceResult` (`todayKey` is a `"YYYY-MM-DD"` string) — used by Task 4's route.

- [ ] **Step 1: Write the failing tests**

`backend/tests/adherence.test.ts`:

```ts
import { calculateAdherence } from '../src/utils/adherence';

function dateNDaysBefore(base: string, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describe('calculateAdherence', () => {
  const today = '2026-07-13';

  it('returns all zeros when there are no records', () => {
    expect(calculateAdherence([], today)).toEqual({
      completedDays: 0,
      missedDays: 30,
      completionRate: 0,
      currentStreak: 0,
    });
  });

  it('counts a full 30-day streak when every day in the window is recorded', () => {
    const dates = Array.from({ length: 30 }, (_, i) => dateNDaysBefore(today, i));
    const result = calculateAdherence(dates, today);
    expect(result.completedDays).toBe(30);
    expect(result.missedDays).toBe(0);
    expect(result.completionRate).toBe(1);
    expect(result.currentStreak).toBe(30);
  });

  it('continues the streak from yesterday when today has no record yet', () => {
    const dates = [dateNDaysBefore(today, 1), dateNDaysBefore(today, 2), dateNDaysBefore(today, 3)];
    const result = calculateAdherence(dates, today);
    expect(result.currentStreak).toBe(3);
    expect(result.completedDays).toBe(3);
  });

  it('resets the streak to 0 when both today and yesterday are missing', () => {
    const dates = [dateNDaysBefore(today, 2), dateNDaysBefore(today, 3)];
    const result = calculateAdherence(dates, today);
    expect(result.currentStreak).toBe(0);
    expect(result.completedDays).toBe(2);
  });

  it('stops the streak at the first gap', () => {
    const dates = [dateNDaysBefore(today, 0), dateNDaysBefore(today, 1), dateNDaysBefore(today, 3)];
    const result = calculateAdherence(dates, today);
    expect(result.currentStreak).toBe(2);
    expect(result.completedDays).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/adherence.test.ts`
Expected: FAIL with "Cannot find module '../src/utils/adherence'".

- [ ] **Step 3: Implement `backend/src/utils/adherence.ts`**

```ts
export interface AdherenceResult {
  completedDays: number;
  missedDays: number;
  completionRate: number;
  currentStreak: number;
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

export function calculateAdherence(recordDates: Date[], todayKey: string): AdherenceResult {
  const recordedDays = new Set(recordDates.map(toDateKey));

  let completedDays = 0;
  for (let i = 0; i < 30; i++) {
    if (recordedDays.has(addDays(todayKey, -i))) completedDays++;
  }
  const missedDays = 30 - completedDays;
  const completionRate = Math.round((completedDays / 30) * 100) / 100;

  let currentStreak = 0;
  let offset = recordedDays.has(todayKey) ? 0 : 1;
  while (recordedDays.has(addDays(todayKey, -offset))) {
    currentStreak++;
    offset++;
  }

  return { completedDays, missedDays, completionRate, currentStreak };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/adherence.test.ts`
Expected: PASS, 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/adherence.ts backend/tests/adherence.test.ts
git commit -m "feat(backend): add adherence calculation utility"
```

---

### Task 3: Reminders CRUD routes

**Files:**
- Create: `backend/src/routes/reminders.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/reminders.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 1), `requireAuth`/`AuthRequest` from `../middleware/auth`, `asyncHandler` from `../utils/asyncHandler` (both already exist from Phase 1).
- Produces: `remindersRouter` mounted at `/reminders` — `GET /` (list own reminders), `POST /` (create, 201), `PUT /:id` (update, only own, 404 otherwise), `DELETE /:id` (delete, only own, 404 otherwise, 204 on success).

- [ ] **Step 1: Create `backend/src/routes/reminders.ts`**

```ts
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
```

- [ ] **Step 2: Mount the router in `backend/src/app.ts`**

Current file (for reference):

```ts
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { profileRouter } from './routes/profile';
import { recordsRouter } from './routes/records';

export const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRouter);
app.use('/profile', profileRouter);
app.use('/records', recordsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
```

Add the import after the `recordsRouter` import, and mount it after `app.use('/records', recordsRouter);` (must stay before the error-handling `app.use` at the bottom):

```ts
import { remindersRouter } from './routes/reminders';
```

```ts
app.use('/reminders', remindersRouter);
```

- [ ] **Step 3: Write the failing tests**

`backend/tests/reminders.test.ts`:

```ts
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    reminder: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  reminder: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

function authHeader(userId = 'user-1') {
  const token = jwt.sign({ userId, role: 'patient' }, process.env.JWT_SECRET || 'dev-secret');
  return `Bearer ${token}`;
}

describe('GET /reminders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/reminders');
    expect(res.status).toBe(401);
  });

  it('returns the reminders for the authenticated user', async () => {
    mockedPrisma.reminder.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
    const res = await request(app).get('/reminders').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('POST /reminders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a reminder with valid input', async () => {
    mockedPrisma.reminder.create.mockResolvedValue({
      id: 'r1',
      userId: 'user-1',
      type: 'blood_pressure',
      title: '',
      time: '09:00',
      weekdays: [1, 3, 5],
      enabled: true,
    });

    const res = await request(app)
      .post('/reminders')
      .set('Authorization', authHeader())
      .send({ type: 'blood_pressure', time: '09:00', weekdays: [1, 3, 5] });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('r1');
  });

  it('rejects an invalid time format with 400', async () => {
    const res = await request(app)
      .post('/reminders')
      .set('Authorization', authHeader())
      .send({ type: 'blood_pressure', time: '9am', weekdays: [1] });

    expect(res.status).toBe(400);
  });

  it('rejects an empty weekdays array with 400', async () => {
    const res = await request(app)
      .post('/reminders')
      .set('Authorization', authHeader())
      .send({ type: 'blood_pressure', time: '09:00', weekdays: [] });

    expect(res.status).toBe(400);
  });

  it('rejects a custom reminder with no title with 400', async () => {
    const res = await request(app)
      .post('/reminders')
      .set('Authorization', authHeader())
      .send({ type: 'custom', time: '09:00', weekdays: [1] });

    expect(res.status).toBe(400);
  });
});

describe('PUT /reminders/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates a reminder owned by the user', async () => {
    mockedPrisma.reminder.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'user-1',
      type: 'blood_pressure',
      title: '',
      time: '09:00',
      weekdays: [1, 3, 5],
      enabled: true,
    });
    mockedPrisma.reminder.update.mockResolvedValue({
      id: 'r1',
      userId: 'user-1',
      type: 'blood_pressure',
      title: '',
      time: '09:00',
      weekdays: [1, 3, 5],
      enabled: false,
    });

    const res = await request(app).put('/reminders/r1').set('Authorization', authHeader()).send({ enabled: false });

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });

  it('returns 404 when the reminder belongs to another user', async () => {
    mockedPrisma.reminder.findUnique.mockResolvedValue({ id: 'r1', userId: 'someone-else' });

    const res = await request(app).put('/reminders/r1').set('Authorization', authHeader()).send({ enabled: false });

    expect(res.status).toBe(404);
  });

  it('returns 404 when the reminder does not exist', async () => {
    mockedPrisma.reminder.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put('/reminders/missing')
      .set('Authorization', authHeader())
      .send({ enabled: false });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /reminders/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes a reminder owned by the user', async () => {
    mockedPrisma.reminder.findUnique.mockResolvedValue({ id: 'r1', userId: 'user-1' });
    mockedPrisma.reminder.delete.mockResolvedValue({ id: 'r1' });

    const res = await request(app).delete('/reminders/r1').set('Authorization', authHeader());

    expect(res.status).toBe(204);
  });

  it('returns 404 when the reminder belongs to another user', async () => {
    mockedPrisma.reminder.findUnique.mockResolvedValue({ id: 'r1', userId: 'someone-else' });

    const res = await request(app).delete('/reminders/r1').set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 4: Run tests and verify pass**

Run: `npx jest tests/reminders.test.ts`
Expected: PASS, 11 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/reminders.ts backend/src/app.ts backend/tests/reminders.test.ts
git commit -m "feat(backend): add reminders CRUD routes"
```

---

### Task 4: Adherence route

**Files:**
- Create: `backend/src/routes/adherence.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/adherenceRoute.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 1), `requireAuth`/`AuthRequest`, `asyncHandler`, `calculateAdherence` (Task 2).
- Produces: `adherenceRouter` mounted at `/adherence` — `GET /?today=YYYY-MM-DD` returns `AdherenceResult` JSON. `today` is optional; falls back to the server's current UTC date if missing or malformed.

- [ ] **Step 1: Create `backend/src/routes/adherence.ts`**

```ts
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
```

- [ ] **Step 2: Mount the router in `backend/src/app.ts`**

Add import after the `remindersRouter` import:

```ts
import { adherenceRouter } from './routes/adherence';
```

Add mount after `app.use('/reminders', remindersRouter);`:

```ts
app.use('/adherence', adherenceRouter);
```

- [ ] **Step 3: Write the failing tests**

`backend/tests/adherenceRoute.test.ts`:

```ts
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    dailyRecord: {
      findMany: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  dailyRecord: { findMany: jest.Mock };
};

function authHeader(userId = 'user-1') {
  const token = jwt.sign({ userId, role: 'patient' }, process.env.JWT_SECRET || 'dev-secret');
  return `Bearer ${token}`;
}

describe('GET /adherence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/adherence');
    expect(res.status).toBe(401);
  });

  it('computes adherence from the records returned by Prisma', async () => {
    mockedPrisma.dailyRecord.findMany.mockResolvedValue([
      { recordDate: new Date('2026-07-13') },
      { recordDate: new Date('2026-07-12') },
    ]);

    const res = await request(app)
      .get('/adherence')
      .query({ today: '2026-07-13' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      completedDays: 2,
      missedDays: 28,
      completionRate: 0.07,
      currentStreak: 2,
    });
  });

  it('queries Prisma with a 30-day window ending on the requested date', async () => {
    mockedPrisma.dailyRecord.findMany.mockResolvedValue([]);

    await request(app).get('/adherence').query({ today: '2026-07-13' }).set('Authorization', authHeader());

    expect(mockedPrisma.dailyRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', recordDate: { gte: new Date('2026-06-14') } },
      })
    );
  });

  it('falls back to the server date when the today query param is missing or malformed', async () => {
    mockedPrisma.dailyRecord.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/adherence')
      .query({ today: 'not-a-date' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.completedDays).toBe(0);
  });
});
```

- [ ] **Step 4: Run tests and verify pass**

Run: `npx jest tests/adherenceRoute.test.ts`
Expected: PASS, 4 passed.

- [ ] **Step 5: Run the full backend suite**

Run: `npm test`
Expected: all backend test files pass (health, db, bmi, validators, auth, profile, records, adherence, reminders, adherenceRoute).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/adherence.ts backend/src/app.ts backend/tests/adherenceRoute.test.ts
git commit -m "feat(backend): add adherence route"
```

---

### Task 5: Local notification scheduling utility (mobile)

**Files:**
- Create: `mobile/src/utils/notifications.ts`

**Interfaces:**
- Produces: `ReminderForScheduling` interface (`id, type, title, time, weekdays`), `requestNotificationPermission(): Promise<boolean>`, `scheduleReminderNotifications(reminder: ReminderForScheduling): Promise<void>`, `cancelReminderNotifications(reminderId: string): Promise<void>` — used by Tasks 8 (form save) and 10 (app-launch resync, notification tap listener setup).

- [ ] **Step 1: Install `expo-notifications`**

Run (from `mobile/`): `npx expo install expo-notifications`
Expected: adds `expo-notifications` to `mobile/package.json` at the SDK 54-compatible version.

- [ ] **Step 2: Create `mobile/src/utils/notifications.ts`**

```ts
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface ReminderForScheduling {
  id: string;
  type: string;
  title: string;
  time: string;
  weekdays: number[];
}

const TYPE_BODY: Record<string, string> = {
  blood_pressure: '测血压',
  medication: '吃药',
  exercise: '运动',
  blood_glucose: '测血糖',
};

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function cancelReminderNotifications(reminderId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter((n) => n.content.data?.reminderId === reminderId);
  await Promise.all(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

export async function scheduleReminderNotifications(reminder: ReminderForScheduling): Promise<void> {
  await cancelReminderNotifications(reminder.id);

  const [hourStr, minuteStr] = reminder.time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const body = reminder.type === 'custom' ? reminder.title : TYPE_BODY[reminder.type] ?? reminder.title;

  for (const weekday of reminder.weekdays) {
    const expoWeekday = weekday + 1; // ours: 0=Sunday..6=Saturday; expo: 1=Sunday..7=Saturday
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '健康提醒',
        body,
        data: { reminderId: reminder.id },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday,
        hour,
        minute,
      },
    });
  }
}
```

- [ ] **Step 3: Verify the project still type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/src/utils/notifications.ts
git commit -m "feat(mobile): add local notification scheduling utility"
```

---

### Task 6: API wrappers + navigation types + navigation ref

**Files:**
- Create: `mobile/src/api/reminders.ts`
- Create: `mobile/src/api/adherence.ts`
- Create: `mobile/src/utils/date.ts`
- Modify: `mobile/src/screens/DailyRecordScreen.tsx`
- Modify: `mobile/src/navigation/types.ts`
- Create: `mobile/src/navigation/navigationRef.ts`

**Interfaces:**
- Produces: `Reminder`/`ReminderInput` types + `getReminders/createReminder/updateReminder/deleteReminder` from `api/reminders.ts`; `AdherenceResult` + `getAdherence()` from `api/adherence.ts`; `todayLocalDate()` from `utils/date.ts`; extended `RootStackParamList` (adds `Reminders: undefined`, `ReminderForm: { reminderId?: string }`, `Adherence: undefined`); `navigationRef`/`navigateToDailyRecord()` from `navigation/navigationRef.ts` — used by Tasks 7–10.

- [ ] **Step 1: Create `mobile/src/utils/date.ts`**

```ts
export function todayLocalDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

- [ ] **Step 2: Update `mobile/src/screens/DailyRecordScreen.tsx` to use the shared helper instead of its local copy**

Remove this block (currently at the top of the file, after the imports):

```ts
function todayLocalDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

Add an import instead, alongside the existing imports at the top of the file:

```ts
import { todayLocalDate } from '../utils/date';
```

The rest of `DailyRecordScreen.tsx` (the `toNumberOrUndefined` helper, the component, `handleSubmit`, styles) is unchanged — `todayLocalDate()` is still called the same way inside `handleSubmit`.

- [ ] **Step 3: Create `mobile/src/api/reminders.ts`**

```ts
import { apiClient } from './client';

export interface Reminder {
  id: string;
  userId: string;
  type: 'blood_pressure' | 'medication' | 'exercise' | 'blood_glucose' | 'custom';
  title: string;
  time: string;
  weekdays: number[];
  enabled: boolean;
}

export type ReminderInput = {
  type: Reminder['type'];
  title: string;
  time: string;
  weekdays: number[];
};

export async function getReminders(): Promise<Reminder[]> {
  const res = await apiClient.get<Reminder[]>('/reminders');
  return res.data;
}

export async function createReminder(input: ReminderInput): Promise<Reminder> {
  const res = await apiClient.post<Reminder>('/reminders', input);
  return res.data;
}

export async function updateReminder(
  id: string,
  input: Partial<ReminderInput> & { enabled?: boolean }
): Promise<Reminder> {
  const res = await apiClient.put<Reminder>(`/reminders/${id}`, input);
  return res.data;
}

export async function deleteReminder(id: string): Promise<void> {
  await apiClient.delete(`/reminders/${id}`);
}
```

- [ ] **Step 4: Create `mobile/src/api/adherence.ts`**

```ts
import { apiClient } from './client';
import { todayLocalDate } from '../utils/date';

export interface AdherenceResult {
  completedDays: number;
  missedDays: number;
  completionRate: number;
  currentStreak: number;
}

export async function getAdherence(): Promise<AdherenceResult> {
  const res = await apiClient.get<AdherenceResult>('/adherence', { params: { today: todayLocalDate() } });
  return res.data;
}
```

- [ ] **Step 5: Replace `mobile/src/navigation/types.ts`**

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
};
```

- [ ] **Step 6: Create `mobile/src/navigation/navigationRef.ts`**

```ts
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToDailyRecord() {
  if (navigationRef.isReady()) {
    navigationRef.navigate('DailyRecord');
  }
}
```

- [ ] **Step 7: Verify the project still type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors (note: this will still show errors for screens not yet updated to use the new routes — there are none yet at this point, since `RootStackParamList` additions are additive and `AppNavigator` isn't wired to the new screens until Task 10).

- [ ] **Step 8: Run the mobile test suite**

Run (from `mobile/`): `npm test`
Expected: existing 4 tests (bmi, validators) still pass — this task adds no new automated tests (`todayLocalDate`, the API wrappers, and the navigation ref have no pure-function test surface beyond what Phase 1 already covers).

- [ ] **Step 9: Commit**

```bash
git add mobile/src/utils/date.ts mobile/src/screens/DailyRecordScreen.tsx mobile/src/api/reminders.ts mobile/src/api/adherence.ts mobile/src/navigation/types.ts mobile/src/navigation/navigationRef.ts
git commit -m "feat(mobile): add reminders/adherence API wrappers and navigation scaffolding"
```

---

### Task 7: Reminders list screen

**Files:**
- Create: `mobile/src/screens/RemindersScreen.tsx`

**Interfaces:**
- Consumes: `RootStackParamList` (Task 6), `getReminders`/`updateReminder`/`deleteReminder`/`Reminder` (Task 6), `scheduleReminderNotifications`/`cancelReminderNotifications` (Task 5).
- Produces: default-exported `RemindersScreen` component, wired into the navigator in Task 10.

- [ ] **Step 1: Create `mobile/src/screens/RemindersScreen.tsx`**

```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Switch, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getReminders, updateReminder, deleteReminder, Reminder } from '../api/reminders';
import { scheduleReminderNotifications, cancelReminderNotifications } from '../utils/notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'Reminders'>;

const TYPE_LABELS: Record<string, string> = {
  blood_pressure: '测血压',
  medication: '吃药',
  exercise: '运动',
  blood_glucose: '测血糖',
  custom: '自定义',
};

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function labelFor(reminder: Reminder): string {
  return reminder.type === 'custom' ? reminder.title : TYPE_LABELS[reminder.type];
}

export default function RemindersScreen({ navigation }: Props) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getReminders()
      .then(setReminders)
      .catch(() => Alert.alert('加载失败', '请稍后重试'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleToggle(reminder: Reminder, enabled: boolean) {
    try {
      const updated = await updateReminder(reminder.id, { enabled });
      setReminders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (enabled) {
        await scheduleReminderNotifications(updated);
      } else {
        await cancelReminderNotifications(updated.id);
      }
    } catch {
      Alert.alert('更新失败', '请稍后重试');
    }
  }

  function handleDelete(reminder: Reminder) {
    Alert.alert('删除提醒', `确定删除"${labelFor(reminder)}"吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReminder(reminder.id);
            await cancelReminderNotifications(reminder.id);
            setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
          } catch {
            Alert.alert('删除失败', '请稍后重试');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>还没有提醒，点下面按钮新建一个</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{labelFor(item)}</Text>
              <Text style={styles.rowSubtitle}>
                {item.time} · {item.weekdays.map((w) => WEEKDAY_LABELS[w]).join('、')}
              </Text>
            </View>
            <Switch value={item.enabled} onValueChange={(v) => handleToggle(item, v)} />
            <Button title="编辑" onPress={() => navigation.navigate('ReminderForm', { reminderId: item.id })} />
            <Button title="删除" color="#c0392b" onPress={() => handleDelete(item)} />
          </View>
        )}
      />
      <Button title="新建提醒" onPress={() => navigation.navigate('ReminderForm', {})} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 12,
    gap: 8,
  },
  rowInfo: { flex: 1 },
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
git add mobile/src/screens/RemindersScreen.tsx
git commit -m "feat(mobile): add reminders list screen"
```

---

### Task 8: Reminder form screen (create/edit)

**Files:**
- Create: `mobile/src/screens/ReminderFormScreen.tsx`

**Interfaces:**
- Consumes: `RootStackParamList` (Task 6), `Reminder`/`getReminders`/`createReminder`/`updateReminder` (Task 6), `requestNotificationPermission`/`scheduleReminderNotifications` (Task 5).
- Produces: default-exported `ReminderFormScreen` component, wired into the navigator in Task 10.

- [ ] **Step 1: Create `mobile/src/screens/ReminderFormScreen.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { createReminder, updateReminder, getReminders, Reminder } from '../api/reminders';
import { requestNotificationPermission, scheduleReminderNotifications } from '../utils/notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'ReminderForm'>;

const TYPES: { value: Reminder['type']; label: string }[] = [
  { value: 'blood_pressure', label: '测血压' },
  { value: 'medication', label: '吃药' },
  { value: 'exercise', label: '运动' },
  { value: 'blood_glucose', label: '测血糖' },
  { value: 'custom', label: '自定义' },
];

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' },
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function ReminderFormScreen({ navigation, route }: Props) {
  const reminderId = route.params.reminderId;
  const [type, setType] = useState<Reminder['type']>('blood_pressure');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [loading, setLoading] = useState(!!reminderId);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!reminderId) return;
    getReminders()
      .then((reminders) => {
        const existing = reminders.find((r) => r.id === reminderId);
        if (existing) {
          setType(existing.type);
          setTitle(existing.title);
          setTime(existing.time);
          setWeekdays(existing.weekdays);
        }
      })
      .catch(() => Alert.alert('加载失败', '请稍后重试'))
      .finally(() => setLoading(false));
  }, [reminderId]);

  function toggleWeekday(day: number) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function handleSubmit() {
    if (type === 'custom' && title.trim() === '') {
      Alert.alert('请完整填写', '自定义提醒需要填写标题');
      return;
    }
    if (!TIME_RE.test(time)) {
      Alert.alert('时间格式不对', '请填写 HH:mm 格式，例如 09:00');
      return;
    }
    if (weekdays.length === 0) {
      Alert.alert('请选择重复日期', '至少选择一个星期几');
      return;
    }

    setSubmitting(true);
    try {
      await requestNotificationPermission();
      const input = { type, title, time, weekdays };
      const saved = reminderId ? await updateReminder(reminderId, input) : await createReminder(input);
      await scheduleReminderNotifications(saved);
      navigation.goBack();
    } catch (err) {
      Alert.alert('保存失败', '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>加载中...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{reminderId ? '编辑提醒' : '新建提醒'}</Text>

      <Text style={styles.label}>类型</Text>
      <View style={styles.chipRow}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.chip, type === t.value && styles.chipSelected]}
            onPress={() => setType(t.value)}
          >
            <Text style={[styles.chipText, type === t.value && styles.chipTextSelected]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {type === 'custom' && <TextInput style={styles.input} placeholder="提醒标题" value={title} onChangeText={setTitle} />}

      <Text style={styles.label}>时间 (HH:mm)</Text>
      <TextInput style={styles.input} placeholder="09:00" value={time} onChangeText={setTime} />

      <Text style={styles.label}>重复</Text>
      <View style={styles.chipRow}>
        {WEEKDAYS.map((w) => (
          <TouchableOpacity
            key={w.value}
            style={[styles.chip, weekdays.includes(w.value) && styles.chipSelected]}
            onPress={() => toggleWeekday(w.value)}
          >
            <Text style={[styles.chipText, weekdays.includes(w.value) && styles.chipTextSelected]}>{w.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button title={submitting ? '保存中...' : '保存'} onPress={handleSubmit} disabled={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  label: { fontWeight: '600', marginBottom: 8, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
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
git add mobile/src/screens/ReminderFormScreen.tsx
git commit -m "feat(mobile): add reminder create/edit form screen"
```

---

### Task 9: Adherence screen

**Files:**
- Create: `mobile/src/screens/AdherenceScreen.tsx`

**Interfaces:**
- Consumes: `getAdherence`/`AdherenceResult` (Task 6).
- Produces: default-exported `AdherenceScreen` component, wired into the navigator in Task 10.

- [ ] **Step 1: Create `mobile/src/screens/AdherenceScreen.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { getAdherence, AdherenceResult } from '../api/adherence';

export default function AdherenceScreen() {
  const [result, setResult] = useState<AdherenceResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdherence()
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>加载失败，请稍后重试</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.bigNumber}>{Math.round(result.completionRate * 100)}%</Text>
        <Text style={styles.label}>最近30天完成率</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{result.currentStreak}</Text>
          <Text style={styles.label}>连续记录天数</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{result.missedDays}</Text>
          <Text style={styles.label}>漏记天数</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { alignItems: 'center', marginBottom: 32 },
  bigNumber: { fontSize: 48, fontWeight: 'bold', color: '#3498db' },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: 32, fontWeight: 'bold' },
  label: { color: '#666', marginTop: 4 },
  empty: { color: '#888' },
});
```

- [ ] **Step 2: Verify the project still type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/AdherenceScreen.tsx
git commit -m "feat(mobile): add adherence screen"
```

---

### Task 10: Home screen entry points + navigator wiring

**Files:**
- Modify: `mobile/src/screens/HomeScreen.tsx`
- Modify: `mobile/src/navigation/AppNavigator.tsx`

**Interfaces:**
- Consumes: `RemindersScreen` (Task 7), `ReminderFormScreen` (Task 8), `AdherenceScreen` (Task 9), `navigationRef`/`navigateToDailyRecord` (Task 6), `getReminders` (Task 6), `scheduleReminderNotifications`/`cancelReminderNotifications` (Task 5).
- Produces: the fully wired Phase 2 app — final deliverable.

- [ ] **Step 1: Modify `mobile/src/screens/HomeScreen.tsx`**

Current button block (for reference):

```tsx
      <Button title="今日记录" onPress={() => navigation.navigate('DailyRecord')} />
      <Button title="历史记录" onPress={() => navigation.navigate('History')} />
      <Button title="趋势图" onPress={() => navigation.navigate('Trends')} />
      <Button title="编辑健康档案" onPress={() => navigation.navigate('ProfileSetup')} />
      <Button title="退出登录" color="#c0392b" onPress={() => logout()} />
```

Replace it with:

```tsx
      <Button title="今日记录" onPress={() => navigation.navigate('DailyRecord')} />
      <Button title="历史记录" onPress={() => navigation.navigate('History')} />
      <Button title="趋势图" onPress={() => navigation.navigate('Trends')} />
      <Button title="健康提醒" onPress={() => navigation.navigate('Reminders')} />
      <Button title="依从性分析" onPress={() => navigation.navigate('Adherence')} />
      <Button title="编辑健康档案" onPress={() => navigation.navigate('ProfileSetup')} />
      <Button title="退出登录" color="#c0392b" onPress={() => logout()} />
```

- [ ] **Step 2: Replace `mobile/src/navigation/AppNavigator.tsx`**

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

- [ ] **Step 3: Verify the whole mobile project type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full mobile test suite**

Run (from `mobile/`): `npm test`
Expected: 4/4 tests still pass (bmi, validators — unchanged from Phase 1).

- [ ] **Step 5: Manually verify on a real device**

This step requires the backend running against a migrated database and Expo Go on a phone (same setup as Phase 1's Task 14, Step 6):

1. Log in to the app. From Home, tap "健康提醒" → tap "新建提醒" → choose type "吃药", set time to a couple of minutes from now (in `HH:mm`, 24-hour format), select today's weekday, save.
2. Confirm the new reminder appears in the list with the correct time/weekday, and that a system notification permission prompt appeared (first time only).
3. Wait for the scheduled time (or set a time 1-2 minutes out for a fast test) — confirm a system notification titled "健康提醒" appears with the reminder's label as the body.
4. Tap the notification — confirm the app opens directly to "今日记录" (DailyRecord screen).
5. Back on the reminders list, toggle the reminder off — confirm no further notification fires at the next scheduled time.
6. Delete a reminder — confirm it disappears from the list and does not fire.
7. From Home, tap "依从性分析" — confirm it shows a completion percentage, current streak, and missed-days count consistent with your test data from Phase 1 (e.g. if you've only ever recorded today, completion rate should be low, streak should be 1).

- [ ] **Step 6: Commit**

```bash
git add mobile/src/screens/HomeScreen.tsx mobile/src/navigation/AppNavigator.tsx
git commit -m "feat(mobile): wire reminders and adherence screens into navigator"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Reminder data model + CRUD → Tasks 1, 3. Adherence calculation + endpoint → Tasks 2, 4. Local notification scheduling (weekly triggers, cancel/reschedule on CRUD, app-launch resync, tap-to-DailyRecord) → Tasks 5, 7, 8, 10. Reminders list/form UI → Tasks 7, 8. Adherence UI → Task 9. Home screen entry points → Task 10.
- **Type consistency:** `Reminder`/`ReminderInput` (Task 6) are consumed identically by `RemindersScreen` (Task 7), `ReminderFormScreen` (Task 8), and `AppNavigator` (Task 10). `ReminderForScheduling` (Task 5) is structurally satisfied by `Reminder` (Task 6) — no field name mismatches. `RootStackParamList`'s `ReminderForm: { reminderId?: string }` (Task 6) is used consistently by both navigation call sites (`RemindersScreen` passing `{ reminderId: item.id }` or `{}`) and the receiving screen (`ReminderFormScreen` reading `route.params.reminderId`).
- **No placeholders:** all steps contain complete, runnable code; no TODOs.
- **DRY:** `todayLocalDate()` is extracted to a shared `mobile/src/utils/date.ts` in Task 6 rather than duplicated between `DailyRecordScreen.tsx` and `api/adherence.ts` (the original Phase 1 copy lived only in `DailyRecordScreen.tsx`; Task 6 relocates it and updates the one call site).
