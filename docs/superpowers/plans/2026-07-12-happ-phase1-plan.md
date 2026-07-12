# HAPP Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 core loop of HAPP — account registration/login, health profile (module 1), daily health records (module 2), and a 30-day trend chart (module 4) — as a working, testable mobile app backed by a real API.

**Architecture:** Monorepo with two packages: `backend/` (Express + TypeScript + PostgreSQL via Prisma, JWT auth) and `mobile/` (Expo + TypeScript + React Navigation). The mobile app talks to the backend over HTTP; there is no offline-first sync in Phase 1 beyond basic error alerts.

**Tech Stack:** Node.js 18+, Express 4, Prisma 5, PostgreSQL, jsonwebtoken, bcryptjs, Jest + Supertest (backend tests); Expo (managed workflow), React Navigation (native-stack), axios, expo-secure-store, react-native-chart-kit, jest-expo (mobile tests).

## Global Constraints

- Node.js >= 18 for both packages.
- TypeScript `strict: true` in both `backend/tsconfig.json` and `mobile/tsconfig.json`.
- Backend auth: JWT passed as `Authorization: Bearer <token>` header; secret from `JWT_SECRET` env var, falling back to `dev-secret` in development.
- Validation ranges (from spec): systolic 50–250, diastolic 30–150, bloodGlucose 1–40 mmol/L, heartRate 30–220, weightKg 20–300, sleepHours 0–24, exerciseMinutes 0–1440, waterMl 0–10000.
- One daily record per `(userId, recordDate)` — resubmitting the same date updates the existing row (upsert), never creates a duplicate.
- Backend route tests mock the Prisma client (`jest.mock('../src/db')`) — no live database is required to run `npm test` in `backend/`.
- Mobile automated tests are limited to pure functions (`bmi.ts`, `validators.ts`) per the spec; screens are verified via TypeScript compilation (`npx tsc --noEmit`) and, in the final task, a manual end-to-end run.
- UI copy is in Chinese, matching the product spec.
- Commit after every task.

---

### Task 1: Backend project scaffold + health check endpoint

**Files:**
- Create: `.gitignore` (repo root)
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/jest.config.js`
- Create: `backend/.env.example`
- Create: `backend/src/app.ts`
- Create: `backend/src/index.ts`
- Test: `backend/tests/health.test.ts`

**Interfaces:**
- Produces: `app` (Express application instance) exported from `backend/src/app.ts`, imported by all later route/test files as `import { app } from '../src/app'` (from `tests/`) or `'./app'` (from `src/`).

- [ ] **Step 1: Create the root `.gitignore`**

```gitignore
node_modules/
dist/
.env
.expo/
*.log
```

- [ ] **Step 2: Create `backend/package.json`**

```json
{
  "name": "happ-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node": "^20.14.9",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "prisma": "^5.20.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 3: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create `backend/jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
};
```

- [ ] **Step 5: Create `backend/.env.example`**

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/happ?schema=public"
JWT_SECRET="change-me-in-production"
PORT=3000
```

- [ ] **Step 6: Create `backend/src/app.ts`**

```ts
import express from 'express';
import cors from 'cors';

export const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
```

- [ ] **Step 7: Create `backend/src/index.ts`**

```ts
import { app } from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`HAPP backend listening on port ${PORT}`);
});
```

- [ ] **Step 8: Write the health check test**

`backend/tests/health.test.ts`:

```ts
import request from 'supertest';
import { app } from '../src/app';

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 9: Install dependencies**

Run (from `backend/`): `npm install`
Expected: installs succeed, `node_modules/` created.

- [ ] **Step 10: Run tests and verify pass**

Run: `npm test`
Expected: `GET /health returns status ok` passes (1 passed, 1 total).

- [ ] **Step 11: Commit**

```bash
git add .gitignore backend/package.json backend/tsconfig.json backend/jest.config.js backend/.env.example backend/src/app.ts backend/src/index.ts backend/tests/health.test.ts
git commit -m "feat(backend): scaffold Express app with health check endpoint"
```

---

### Task 2: Prisma schema + database client

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/db.ts`
- Test: `backend/tests/db.test.ts`

**Interfaces:**
- Consumes: nothing new (standalone).
- Produces: `prisma` (PrismaClient instance) exported from `backend/src/db.ts` as `import { prisma } from '../db'` — used by every route file from Task 5 onward. Prisma models: `User` (id, email, passwordHash, name, role, createdAt), `HealthProfile` (id, userId, age, gender, heightCm, weightKg, chronicConditions[], medications[], allergies, updatedAt), `DailyRecord` (id, userId, recordDate, systolic, diastolic, bloodGlucose, heartRate, weightKg, sleepHours, exerciseMinutes, waterMl, createdAt, updatedAt; unique on `(userId, recordDate)` exposed as Prisma's compound key `userId_recordDate`).

- [ ] **Step 1: Create `backend/prisma/schema.prisma`**

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

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role     @default(patient)
  createdAt    DateTime @default(now())

  healthProfile HealthProfile?
  dailyRecords  DailyRecord[]
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
```

- [ ] **Step 2: Create `backend/src/db.ts`**

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 3: Generate the Prisma client**

Run (from `backend/`): `npx prisma generate`
Expected: `Generated Prisma Client` message; this only generates TypeScript types from the schema and does not require a reachable database.

- [ ] **Step 4: Write a test confirming the client exposes the expected models**

`backend/tests/db.test.ts`:

```ts
import { prisma } from '../src/db';

describe('prisma client', () => {
  it('exposes model delegates for User, HealthProfile, DailyRecord', () => {
    expect(typeof prisma.user.create).toBe('function');
    expect(typeof prisma.healthProfile.upsert).toBe('function');
    expect(typeof prisma.dailyRecord.upsert).toBe('function');
  });
});
```

- [ ] **Step 5: Run tests and verify pass**

Run: `npx jest tests/db.test.ts --verbose`
Expected: PASS, all 3 assertions pass (no live database connection is made by this test).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/db.ts backend/tests/db.test.ts
git commit -m "feat(backend): add Prisma schema for User, HealthProfile, DailyRecord"
```

---

### Task 3: BMI calculation utility (backend)

**Files:**
- Create: `backend/src/utils/bmi.ts`
- Test: `backend/tests/bmi.test.ts`

**Interfaces:**
- Produces: `calculateBmi(heightCm: number, weightKg: number): number` — used by Task 6 (`profile.ts`) to compute BMI on read/write.

- [ ] **Step 1: Write the failing test**

`backend/tests/bmi.test.ts`:

```ts
import { calculateBmi } from '../src/utils/bmi';

describe('calculateBmi', () => {
  it('calculates BMI rounded to 1 decimal', () => {
    expect(calculateBmi(170, 65)).toBe(22.5);
  });

  it('handles a different height/weight combo', () => {
    expect(calculateBmi(160, 50)).toBe(19.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/bmi.test.ts`
Expected: FAIL with "Cannot find module '../src/utils/bmi'".

- [ ] **Step 3: Implement `backend/src/utils/bmi.ts`**

```ts
export function calculateBmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/bmi.test.ts`
Expected: PASS, 2 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/bmi.ts backend/tests/bmi.test.ts
git commit -m "feat(backend): add BMI calculation utility"
```

---

### Task 4: Daily record validators (backend)

**Files:**
- Create: `backend/src/utils/validators.ts`
- Test: `backend/tests/validators.test.ts`

**Interfaces:**
- Produces: `DailyRecordInput` interface and `validateDailyRecord(input: DailyRecordInput): string[]` (empty array = valid) — used by Task 7 (`records.ts`).

- [ ] **Step 1: Write the failing test**

`backend/tests/validators.test.ts`:

```ts
import { validateDailyRecord } from '../src/utils/validators';

describe('validateDailyRecord', () => {
  it('returns no errors for a fully valid record', () => {
    expect(
      validateDailyRecord({
        systolic: 120,
        diastolic: 80,
        bloodGlucose: 5.5,
        heartRate: 70,
        weightKg: 65,
        sleepHours: 8,
        exerciseMinutes: 30,
        waterMl: 2000,
      })
    ).toEqual([]);
  });

  it('returns no errors when all fields are omitted', () => {
    expect(validateDailyRecord({})).toEqual([]);
  });

  it('flags systolic out of range', () => {
    expect(validateDailyRecord({ systolic: 300 })).toContain('systolic must be between 50 and 250');
  });

  it('flags heartRate out of range', () => {
    expect(validateDailyRecord({ heartRate: 10 })).toContain('heartRate must be between 30 and 220');
  });

  it('flags sleepHours out of range', () => {
    expect(validateDailyRecord({ sleepHours: 30 })).toContain('sleepHours must be between 0 and 24');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/validators.test.ts`
Expected: FAIL with "Cannot find module '../src/utils/validators'".

- [ ] **Step 3: Implement `backend/src/utils/validators.ts`**

```ts
export interface DailyRecordInput {
  systolic?: number;
  diastolic?: number;
  bloodGlucose?: number;
  heartRate?: number;
  weightKg?: number;
  sleepHours?: number;
  exerciseMinutes?: number;
  waterMl?: number;
}

export function validateDailyRecord(input: DailyRecordInput): string[] {
  const errors: string[] = [];

  if (input.systolic !== undefined && (input.systolic < 50 || input.systolic > 250)) {
    errors.push('systolic must be between 50 and 250');
  }
  if (input.diastolic !== undefined && (input.diastolic < 30 || input.diastolic > 150)) {
    errors.push('diastolic must be between 30 and 150');
  }
  if (input.bloodGlucose !== undefined && (input.bloodGlucose < 1 || input.bloodGlucose > 40)) {
    errors.push('bloodGlucose must be between 1 and 40 mmol/L');
  }
  if (input.heartRate !== undefined && (input.heartRate < 30 || input.heartRate > 220)) {
    errors.push('heartRate must be between 30 and 220');
  }
  if (input.weightKg !== undefined && (input.weightKg < 20 || input.weightKg > 300)) {
    errors.push('weightKg must be between 20 and 300');
  }
  if (input.sleepHours !== undefined && (input.sleepHours < 0 || input.sleepHours > 24)) {
    errors.push('sleepHours must be between 0 and 24');
  }
  if (input.exerciseMinutes !== undefined && (input.exerciseMinutes < 0 || input.exerciseMinutes > 1440)) {
    errors.push('exerciseMinutes must be between 0 and 1440');
  }
  if (input.waterMl !== undefined && (input.waterMl < 0 || input.waterMl > 10000)) {
    errors.push('waterMl must be between 0 and 10000');
  }

  return errors;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/validators.test.ts`
Expected: PASS, 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/validators.ts backend/tests/validators.test.ts
git commit -m "feat(backend): add daily record range validators"
```

---

### Task 5: Auth routes + JWT middleware

**Files:**
- Create: `backend/src/middleware/auth.ts`
- Create: `backend/src/routes/auth.ts`
- Modify: `backend/src/app.ts` (mount `authRouter`)
- Test: `backend/tests/auth.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../db` (Task 2).
- Produces: `requireAuth(req, res, next)` and `AuthRequest` (extends `Request` with `userId?: string`, `role?: string`) from `backend/src/middleware/auth.ts`, used by Tasks 6 and 7. `authRouter` mounted at `/auth` exposing `POST /auth/register` and `POST /auth/login`, both returning `{ token, user: { id, email, name, role } }`.

- [ ] **Step 1: Create `backend/src/middleware/auth.ts`**

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

- [ ] **Step 2: Create `backend/src/routes/auth.ts`**

```ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
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
});

authRouter.post('/login', async (req, res) => {
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
});

function signToken(userId: string, role: string): string {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return jwt.sign({ userId, role }, secret, { expiresIn: '30d' });
}
```

- [ ] **Step 3: Mount the router in `backend/src/app.ts`**

Add near the top (after the `express()`/middleware setup, before `app.get('/health', ...)` or after — order doesn't matter for routing):

```ts
import { authRouter } from './routes/auth';
```

And after `app.use(express.json());`:

```ts
app.use('/auth', authRouter);
```

- [ ] **Step 4: Write the failing tests**

`backend/tests/auth.test.ts`:

```ts
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; create: jest.Mock };
};

describe('POST /auth/register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a new user and returns a token', async () => {
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
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toEqual({ id: 'user-1', email: 'a@example.com', name: 'Alice', role: 'patient' });
  });

  it('rejects duplicate email with 409', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'a@example.com', password: 'password123', name: 'Alice' });

    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects unknown email with 401', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('rejects wrong password with 401', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      name: 'Alice',
      role: 'patient',
      passwordHash: bcrypt.hashSync('correct-password', 10),
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'a@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('logs in with correct credentials', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      name: 'Alice',
      role: 'patient',
      passwordHash: bcrypt.hashSync('correct-password', 10),
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'a@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npx jest tests/auth.test.ts`
Expected: FAIL (module `../src/routes/auth` / `../src/middleware/auth` not found, or app has no `/auth` routes) — confirms the test exercises code that doesn't exist yet if run before Steps 1–3; if Steps 1–3 are already done, skip to Step 6.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest tests/auth.test.ts`
Expected: PASS, 5 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/src/middleware/auth.ts backend/src/routes/auth.ts backend/src/app.ts backend/tests/auth.test.ts
git commit -m "feat(backend): add register/login routes with JWT auth"
```

---

### Task 6: Health profile routes

**Files:**
- Create: `backend/src/routes/profile.ts`
- Modify: `backend/src/app.ts` (mount `profileRouter`)
- Test: `backend/tests/profile.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `requireAuth`/`AuthRequest` (Task 5), `calculateBmi` (Task 3).
- Produces: `profileRouter` mounted at `/profile` exposing `GET /profile` (200 with profile + `bmi`, or 404) and `PUT /profile` (upsert, 200 with profile + `bmi`, or 400 on missing required fields).

- [ ] **Step 1: Create `backend/src/routes/profile.ts`**

```ts
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
```

- [ ] **Step 2: Mount the router in `backend/src/app.ts`**

Add import: `import { profileRouter } from './routes/profile';`
Add after `app.use('/auth', authRouter);`: `app.use('/profile', profileRouter);`

- [ ] **Step 3: Write the failing tests**

`backend/tests/profile.test.ts`:

```ts
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    healthProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  healthProfile: { findUnique: jest.Mock; upsert: jest.Mock };
};

function authHeader(userId = 'user-1') {
  const token = jwt.sign({ userId, role: 'patient' }, process.env.JWT_SECRET || 'dev-secret');
  return `Bearer ${token}`;
}

describe('GET /profile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/profile');
    expect(res.status).toBe(401);
  });

  it('returns profile with computed bmi', async () => {
    mockedPrisma.healthProfile.findUnique.mockResolvedValue({
      id: 'p1',
      userId: 'user-1',
      age: 40,
      gender: 'female',
      heightCm: 170,
      weightKg: 65,
      chronicConditions: ['hypertension'],
      medications: [],
      allergies: null,
      updatedAt: new Date(),
    });

    const res = await request(app).get('/profile').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.bmi).toBe(22.5);
  });

  it('returns 404 when profile does not exist', async () => {
    mockedPrisma.healthProfile.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/profile').set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });
});

describe('PUT /profile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates/updates the profile and returns bmi', async () => {
    mockedPrisma.healthProfile.upsert.mockResolvedValue({
      id: 'p1',
      userId: 'user-1',
      age: 40,
      gender: 'female',
      heightCm: 160,
      weightKg: 50,
      chronicConditions: [],
      medications: [],
      allergies: null,
      updatedAt: new Date(),
    });

    const res = await request(app)
      .put('/profile')
      .set('Authorization', authHeader())
      .send({ age: 40, gender: 'female', heightCm: 160, weightKg: 50 });

    expect(res.status).toBe(200);
    expect(res.body.bmi).toBe(19.5);
  });

  it('rejects missing required fields with 400', async () => {
    const res = await request(app)
      .put('/profile')
      .set('Authorization', authHeader())
      .send({ age: 40 });

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4: Run tests and verify pass**

Run: `npx jest tests/profile.test.ts`
Expected: PASS, 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/profile.ts backend/src/app.ts backend/tests/profile.test.ts
git commit -m "feat(backend): add health profile GET/PUT routes"
```

---

### Task 7: Daily records routes

**Files:**
- Create: `backend/src/routes/records.ts`
- Modify: `backend/src/app.ts` (mount `recordsRouter`)
- Test: `backend/tests/records.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `requireAuth`/`AuthRequest` (Task 5), `validateDailyRecord` (Task 4).
- Produces: `recordsRouter` mounted at `/records` exposing `POST /records` (upsert by `(userId, recordDate)`, 400 on invalid range or missing `recordDate`) and `GET /records?days=30` (array of records for the last N days, ascending by date).

- [ ] **Step 1: Create `backend/src/routes/records.ts`**

```ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validateDailyRecord } from '../utils/validators';

export const recordsRouter = Router();

recordsRouter.post('/', requireAuth, async (req: AuthRequest, res) => {
  const {
    recordDate,
    systolic,
    diastolic,
    bloodGlucose,
    heartRate,
    weightKg,
    sleepHours,
    exerciseMinutes,
    waterMl,
  } = req.body;

  if (!recordDate) {
    return res.status(400).json({ error: 'recordDate is required (YYYY-MM-DD)' });
  }

  const errors = validateDailyRecord({
    systolic,
    diastolic,
    bloodGlucose,
    heartRate,
    weightKg,
    sleepHours,
    exerciseMinutes,
    waterMl,
  });
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const data = { systolic, diastolic, bloodGlucose, heartRate, weightKg, sleepHours, exerciseMinutes, waterMl };

  const record = await prisma.dailyRecord.upsert({
    where: { userId_recordDate: { userId: req.userId!, recordDate: new Date(recordDate) } },
    update: data,
    create: { userId: req.userId!, recordDate: new Date(recordDate), ...data },
  });

  res.status(200).json(record);
});

recordsRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
  const days = req.query.days ? Number(req.query.days) : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const records = await prisma.dailyRecord.findMany({
    where: { userId: req.userId!, recordDate: { gte: since } },
    orderBy: { recordDate: 'asc' },
  });

  res.json(records);
});
```

- [ ] **Step 2: Mount the router in `backend/src/app.ts`**

Add import: `import { recordsRouter } from './routes/records';`
Add after `app.use('/profile', profileRouter);`: `app.use('/records', recordsRouter);`

- [ ] **Step 3: Write the failing tests**

`backend/tests/records.test.ts`:

```ts
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    dailyRecord: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  dailyRecord: { upsert: jest.Mock; findMany: jest.Mock };
};

function authHeader(userId = 'user-1') {
  const token = jwt.sign({ userId, role: 'patient' }, process.env.JWT_SECRET || 'dev-secret');
  return `Bearer ${token}`;
}

describe('POST /records', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects missing recordDate with 400', async () => {
    const res = await request(app)
      .post('/records')
      .set('Authorization', authHeader())
      .send({ systolic: 120 });

    expect(res.status).toBe(400);
  });

  it('rejects out-of-range values with 400', async () => {
    const res = await request(app)
      .post('/records')
      .set('Authorization', authHeader())
      .send({ recordDate: '2026-07-12', systolic: 999 });

    expect(res.status).toBe(400);
  });

  it('upserts a valid record and returns it', async () => {
    mockedPrisma.dailyRecord.upsert.mockResolvedValue({
      id: 'r1',
      userId: 'user-1',
      recordDate: '2026-07-12T00:00:00.000Z',
      systolic: 120,
      diastolic: 80,
      bloodGlucose: 5.5,
      heartRate: 70,
      weightKg: 65,
      sleepHours: 8,
      exerciseMinutes: 30,
      waterMl: 2000,
    });

    const res = await request(app)
      .post('/records')
      .set('Authorization', authHeader())
      .send({
        recordDate: '2026-07-12',
        systolic: 120,
        diastolic: 80,
        bloodGlucose: 5.5,
        heartRate: 70,
        weightKg: 65,
        sleepHours: 8,
        exerciseMinutes: 30,
        waterMl: 2000,
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('r1');
  });
});

describe('GET /records', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/records');
    expect(res.status).toBe(401);
  });

  it('returns the records array for the authenticated user', async () => {
    mockedPrisma.dailyRecord.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);

    const res = await request(app).get('/records?days=30').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});
```

- [ ] **Step 4: Run tests and verify pass**

Run: `npx jest tests/records.test.ts`
Expected: PASS, 5 passed.

- [ ] **Step 5: Run the full backend suite**

Run: `npm test`
Expected: all backend test files pass (health, db, bmi, validators, auth, profile, records).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/records.ts backend/src/app.ts backend/tests/records.test.ts
git commit -m "feat(backend): add daily records upsert/list routes"
```

---

### Task 8: Mobile project scaffold + shared utils

**Files:**
- Create: `mobile/` (via `create-expo-app`)
- Create: `mobile/src/utils/bmi.ts`
- Create: `mobile/src/utils/validators.ts`
- Create: `mobile/src/navigation/types.ts`
- Test: `mobile/__tests__/bmi.test.ts`
- Test: `mobile/__tests__/validators.test.ts`

**Interfaces:**
- Produces: `calculateBmi(heightCm, weightKg): number` and `validateDailyRecord(input): string[]` (same behavior as the backend versions, duplicated client-side for instant form feedback), and `RootStackParamList` type (`Login`, `Register`, `ProfileSetup`, `Home`, `DailyRecord`, `History`, `Trends`, all `undefined` params) from `mobile/src/navigation/types.ts` — used by every screen task from Task 10 onward.

- [ ] **Step 1: Scaffold the Expo project**

Run (from the repo root `C:\Users\h1810\.vscode\HAPP`): `npx create-expo-app@latest mobile --template blank-typescript`
Expected: `mobile/` directory created with `App.tsx`, `package.json`, `tsconfig.json`, `babel.config.js`, `app.json`, `assets/`.

- [ ] **Step 2: Install additional dependencies**

Run (from `mobile/`):
```bash
npx expo install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context expo-secure-store axios react-native-chart-kit react-native-svg
```
Expected: dependencies added to `mobile/package.json` at Expo-compatible versions.

- [ ] **Step 3: Add Jest tooling**

Run (from `mobile/`): `npm install --save-dev jest jest-expo @types/jest`

Then edit `mobile/package.json` to add a `test` script and `jest` config:

```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo"
  }
}
```

(Merge these into the existing `package.json` generated in Step 1 — do not overwrite the `dependencies`/`devDependencies` already present.)

- [ ] **Step 4: Create `mobile/src/navigation/types.ts`**

```ts
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ProfileSetup: undefined;
  Home: undefined;
  DailyRecord: undefined;
  History: undefined;
  Trends: undefined;
};
```

- [ ] **Step 5: Write the failing utils tests**

`mobile/__tests__/bmi.test.ts`:

```ts
import { calculateBmi } from '../src/utils/bmi';

describe('calculateBmi', () => {
  it('calculates BMI rounded to 1 decimal', () => {
    expect(calculateBmi(170, 65)).toBe(22.5);
  });

  it('handles a different height/weight combo', () => {
    expect(calculateBmi(160, 50)).toBe(19.5);
  });
});
```

`mobile/__tests__/validators.test.ts`:

```ts
import { validateDailyRecord } from '../src/utils/validators';

describe('validateDailyRecord', () => {
  it('returns no errors for a fully valid record', () => {
    expect(
      validateDailyRecord({
        systolic: 120,
        diastolic: 80,
        bloodGlucose: 5.5,
        heartRate: 70,
        weightKg: 65,
        sleepHours: 8,
        exerciseMinutes: 30,
        waterMl: 2000,
      })
    ).toEqual([]);
  });

  it('flags systolic out of range', () => {
    expect(validateDailyRecord({ systolic: 300 })).toContain('systolic must be between 50 and 250');
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run (from `mobile/`): `npx jest __tests__/bmi.test.ts __tests__/validators.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 7: Implement `mobile/src/utils/bmi.ts`**

```ts
export function calculateBmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
}
```

- [ ] **Step 8: Implement `mobile/src/utils/validators.ts`**

```ts
export interface DailyRecordInput {
  systolic?: number;
  diastolic?: number;
  bloodGlucose?: number;
  heartRate?: number;
  weightKg?: number;
  sleepHours?: number;
  exerciseMinutes?: number;
  waterMl?: number;
}

export function validateDailyRecord(input: DailyRecordInput): string[] {
  const errors: string[] = [];

  if (input.systolic !== undefined && (input.systolic < 50 || input.systolic > 250)) {
    errors.push('systolic must be between 50 and 250');
  }
  if (input.diastolic !== undefined && (input.diastolic < 30 || input.diastolic > 150)) {
    errors.push('diastolic must be between 30 and 150');
  }
  if (input.bloodGlucose !== undefined && (input.bloodGlucose < 1 || input.bloodGlucose > 40)) {
    errors.push('bloodGlucose must be between 1 and 40 mmol/L');
  }
  if (input.heartRate !== undefined && (input.heartRate < 30 || input.heartRate > 220)) {
    errors.push('heartRate must be between 30 and 220');
  }
  if (input.weightKg !== undefined && (input.weightKg < 20 || input.weightKg > 300)) {
    errors.push('weightKg must be between 20 and 300');
  }
  if (input.sleepHours !== undefined && (input.sleepHours < 0 || input.sleepHours > 24)) {
    errors.push('sleepHours must be between 0 and 24');
  }
  if (input.exerciseMinutes !== undefined && (input.exerciseMinutes < 0 || input.exerciseMinutes > 1440)) {
    errors.push('exerciseMinutes must be between 0 and 1440');
  }
  if (input.waterMl !== undefined && (input.waterMl < 0 || input.waterMl > 10000)) {
    errors.push('waterMl must be between 0 and 10000');
  }

  return errors;
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run (from `mobile/`): `npx jest __tests__/bmi.test.ts __tests__/validators.test.ts`
Expected: PASS, 4 passed.

- [ ] **Step 10: Commit**

```bash
git add mobile/ 
git commit -m "feat(mobile): scaffold Expo app with shared bmi/validators utils"
```

---

### Task 9: API client + AuthContext

**Files:**
- Create: `mobile/src/api/client.ts`
- Create: `mobile/src/api/auth.ts`
- Create: `mobile/src/api/profile.ts`
- Create: `mobile/src/api/records.ts`
- Create: `mobile/src/context/AuthContext.tsx`

**Interfaces:**
- Consumes: nothing from earlier mobile tasks (standalone data layer).
- Produces: `apiClient` (axios instance) and `setAuthToken(token: string | null)` from `client.ts`; `login`/`register` from `auth.ts`; `getProfile`/`saveProfile`/`HealthProfile` from `profile.ts`; `getRecords`/`saveDailyRecord`/`DailyRecord`/`DailyRecordInput` from `records.ts`; `AuthProvider` and `useAuth()` (returns `{ user, token, isLoading, login, register, logout }`) from `AuthContext.tsx` — used by every screen task from Task 10 onward.

- [ ] **Step 1: Create `mobile/src/api/client.ts`**

```ts
import axios from 'axios';

// Point this at your backend's LAN address when testing on a physical device,
// e.g. http://192.168.1.20:3000
export const API_BASE_URL = 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
}
```

- [ ] **Step 2: Create `mobile/src/api/auth.ts`**

```ts
import { apiClient } from './client';

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; name: string; role: string };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  return res.data;
}

export async function register(email: string, password: string, name: string): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/register', { email, password, name });
  return res.data;
}
```

- [ ] **Step 3: Create `mobile/src/api/profile.ts`**

```ts
import { apiClient } from './client';

export interface HealthProfile {
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

export async function getProfile(): Promise<HealthProfile | null> {
  try {
    const res = await apiClient.get<HealthProfile>('/profile');
    return res.data;
  } catch (err: any) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

export async function saveProfile(input: {
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  chronicConditions: string[];
  medications: string[];
  allergies: string;
}): Promise<HealthProfile> {
  const res = await apiClient.put<HealthProfile>('/profile', input);
  return res.data;
}
```

- [ ] **Step 4: Create `mobile/src/api/records.ts`**

```ts
import { apiClient } from './client';

export interface DailyRecord {
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

export type DailyRecordInput = Partial<
  Pick<
    DailyRecord,
    'systolic' | 'diastolic' | 'bloodGlucose' | 'heartRate' | 'weightKg' | 'sleepHours' | 'exerciseMinutes' | 'waterMl'
  >
> & { recordDate: string };

export async function saveDailyRecord(input: DailyRecordInput): Promise<DailyRecord> {
  const res = await apiClient.post<DailyRecord>('/records', input);
  return res.data;
}

export async function getRecords(days = 30): Promise<DailyRecord[]> {
  const res = await apiClient.get<DailyRecord[]>('/records', { params: { days } });
  return res.data;
}
```

- [ ] **Step 5: Create `mobile/src/context/AuthContext.tsx`**

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { login as apiLogin, register as apiRegister } from '../api/auth';
import { setAuthToken } from '../api/client';

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
      if (stored) setToken(stored);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  async function login(email: string, password: string) {
    const res = await apiLogin(email, password);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function register(email: string, password: string, name: string) {
    const res = await apiRegister(email, password, name);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

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

- [ ] **Step 6: Verify the project still type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/api mobile/src/context
git commit -m "feat(mobile): add API client and AuthContext"
```

---

### Task 10: Profile setup screen

**Files:**
- Create: `mobile/src/screens/ProfileSetupScreen.tsx`

**Interfaces:**
- Consumes: `RootStackParamList` (Task 8), `saveProfile` (Task 9), `calculateBmi` (Task 8).
- Produces: default-exported `ProfileSetupScreen` component, wired into the navigator in Task 14.

- [ ] **Step 1: Create `mobile/src/screens/ProfileSetupScreen.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { saveProfile } from '../api/profile';
import { calculateBmi } from '../utils/bmi';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSetup'>;

export default function ProfileSetupScreen({ navigation }: Props) {
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [allergies, setAllergies] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const heightNum = parseFloat(heightCm);
  const weightNum = parseFloat(weightKg);
  const bmi = heightNum > 0 && weightNum > 0 ? calculateBmi(heightNum, weightNum) : null;

  async function handleSubmit() {
    if (!age || !gender || !heightNum || !weightNum) {
      Alert.alert('请完整填写', '年龄、性别、身高、体重为必填项');
      return;
    }
    setSubmitting(true);
    try {
      await saveProfile({
        age: parseInt(age, 10),
        gender,
        heightCm: heightNum,
        weightKg: weightNum,
        chronicConditions: chronicConditions.split(',').map((s) => s.trim()).filter(Boolean),
        medications: medications.split(',').map((s) => s.trim()).filter(Boolean),
        allergies,
      });
      navigation.replace('Home');
    } catch (err) {
      Alert.alert('保存失败', '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>健康档案</Text>
      <TextInput style={styles.input} placeholder="年龄" keyboardType="numeric" value={age} onChangeText={setAge} />
      <TextInput style={styles.input} placeholder="性别" value={gender} onChangeText={setGender} />
      <TextInput style={styles.input} placeholder="身高 (cm)" keyboardType="numeric" value={heightCm} onChangeText={setHeightCm} />
      <TextInput style={styles.input} placeholder="体重 (kg)" keyboardType="numeric" value={weightKg} onChangeText={setWeightKg} />
      {bmi !== null && <Text style={styles.bmi}>BMI: {bmi}</Text>}
      <TextInput
        style={styles.input}
        placeholder="慢病类型（逗号分隔，如：高血压,糖尿病）"
        value={chronicConditions}
        onChangeText={setChronicConditions}
      />
      <TextInput
        style={styles.input}
        placeholder="正在服用药物（逗号分隔）"
        value={medications}
        onChangeText={setMedications}
      />
      <TextInput style={styles.input} placeholder="过敏史" value={allergies} onChangeText={setAllergies} />
      <Button title={submitting ? '保存中...' : '保存'} onPress={handleSubmit} disabled={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  bmi: { fontSize: 16, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
});
```

- [ ] **Step 2: Verify the project still type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/ProfileSetupScreen.tsx
git commit -m "feat(mobile): add profile setup screen"
```

---

### Task 11: Home screen + Daily record screen

**Files:**
- Create: `mobile/src/screens/HomeScreen.tsx`
- Create: `mobile/src/screens/DailyRecordScreen.tsx`

**Interfaces:**
- Consumes: `RootStackParamList` (Task 8), `getProfile` (Task 9), `useAuth` (Task 9), `saveDailyRecord` (Task 9), `validateDailyRecord` (Task 8).
- Produces: default-exported `HomeScreen` and `DailyRecordScreen` components, wired into the navigator in Task 14.

- [ ] **Step 1: Create `mobile/src/screens/HomeScreen.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getProfile } from '../api/profile';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    getProfile().then((profile) => {
      if (!active) return;
      if (!profile) {
        navigation.replace('ProfileSetup');
      } else {
        setChecking(false);
      }
    });
    return () => {
      active = false;
    };
  }, [navigation]);

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>欢迎回来</Text>
      <Button title="今日记录" onPress={() => navigation.navigate('DailyRecord')} />
      <Button title="历史记录" onPress={() => navigation.navigate('History')} />
      <Button title="趋势图" onPress={() => navigation.navigate('Trends')} />
      <Button title="编辑健康档案" onPress={() => navigation.navigate('ProfileSetup')} />
      <Button title="退出登录" color="#c0392b" onPress={() => logout()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
});
```

- [ ] **Step 2: Create `mobile/src/screens/DailyRecordScreen.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { saveDailyRecord } from '../api/records';
import { validateDailyRecord } from '../utils/validators';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyRecord'>;

function toNumberOrUndefined(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export default function DailyRecordScreen({ navigation }: Props) {
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [bloodGlucose, setBloodGlucose] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [exerciseMinutes, setExerciseMinutes] = useState('');
  const [waterMl, setWaterMl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const input = {
      systolic: toNumberOrUndefined(systolic),
      diastolic: toNumberOrUndefined(diastolic),
      bloodGlucose: toNumberOrUndefined(bloodGlucose),
      heartRate: toNumberOrUndefined(heartRate),
      weightKg: toNumberOrUndefined(weightKg),
      sleepHours: toNumberOrUndefined(sleepHours),
      exerciseMinutes: toNumberOrUndefined(exerciseMinutes),
      waterMl: toNumberOrUndefined(waterMl),
    };

    const errors = validateDailyRecord(input);
    if (errors.length > 0) {
      Alert.alert('请检查填写内容', errors.join('\n'));
      return;
    }

    setSubmitting(true);
    try {
      const recordDate = new Date().toISOString().slice(0, 10);
      await saveDailyRecord({ recordDate, ...input });
      navigation.goBack();
    } catch (err) {
      Alert.alert('保存失败', '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>今日记录</Text>
      <TextInput style={styles.input} placeholder="收缩压" keyboardType="numeric" value={systolic} onChangeText={setSystolic} />
      <TextInput style={styles.input} placeholder="舒张压" keyboardType="numeric" value={diastolic} onChangeText={setDiastolic} />
      <TextInput style={styles.input} placeholder="血糖 (mmol/L)" keyboardType="numeric" value={bloodGlucose} onChangeText={setBloodGlucose} />
      <TextInput style={styles.input} placeholder="心率" keyboardType="numeric" value={heartRate} onChangeText={setHeartRate} />
      <TextInput style={styles.input} placeholder="体重 (kg)" keyboardType="numeric" value={weightKg} onChangeText={setWeightKg} />
      <TextInput style={styles.input} placeholder="睡眠时长 (小时)" keyboardType="numeric" value={sleepHours} onChangeText={setSleepHours} />
      <TextInput style={styles.input} placeholder="运动时长 (分钟)" keyboardType="numeric" value={exerciseMinutes} onChangeText={setExerciseMinutes} />
      <TextInput style={styles.input} placeholder="饮水量 (ml)" keyboardType="numeric" value={waterMl} onChangeText={setWaterMl} />
      <Button title={submitting ? '保存中...' : '保存'} onPress={handleSubmit} disabled={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
});
```

- [ ] **Step 3: Verify the project still type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/screens/HomeScreen.tsx mobile/src/screens/DailyRecordScreen.tsx
git commit -m "feat(mobile): add home and daily record screens"
```

---

### Task 12: History screen + Trends screen

**Files:**
- Create: `mobile/src/screens/HistoryScreen.tsx`
- Create: `mobile/src/screens/TrendsScreen.tsx`

**Interfaces:**
- Consumes: `getRecords`/`DailyRecord` (Task 9).
- Produces: default-exported `HistoryScreen` and `TrendsScreen` components, wired into the navigator in Task 14.

- [ ] **Step 1: Create `mobile/src/screens/HistoryScreen.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { getRecords, DailyRecord } from '../api/records';

export default function HistoryScreen() {
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecords(30).then((data) => {
      setRecords([...data].reverse());
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={records}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.empty}>暂无记录</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.date}>{item.recordDate.slice(0, 10)}</Text>
          <Text>血压: {item.systolic ?? '-'}/{item.diastolic ?? '-'}　血糖: {item.bloodGlucose ?? '-'}</Text>
          <Text>心率: {item.heartRate ?? '-'}　体重: {item.weightKg ?? '-'}kg</Text>
          <Text>睡眠: {item.sleepHours ?? '-'}h　运动: {item.exerciseMinutes ?? '-'}min　饮水: {item.waterMl ?? '-'}ml</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  row: { borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 12 },
  date: { fontWeight: 'bold', marginBottom: 4 },
  empty: { textAlign: 'center', marginTop: 32, color: '#888' },
});
```

- [ ] **Step 2: Create `mobile/src/screens/TrendsScreen.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { getRecords, DailyRecord } from '../api/records';

type Metric = 'bloodPressure' | 'bloodGlucose' | 'weightKg';

export default function TrendsScreen() {
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>('bloodPressure');

  useEffect(() => {
    getRecords(30).then((data) => {
      setRecords(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const labels = records.map((r) => r.recordDate.slice(5, 10));

  const datasets =
    metric === 'bloodPressure'
      ? [
          { data: records.map((r) => r.systolic ?? 0), color: () => '#e74c3c' },
          { data: records.map((r) => r.diastolic ?? 0), color: () => '#3498db' },
        ]
      : metric === 'bloodGlucose'
      ? [{ data: records.map((r) => r.bloodGlucose ?? 0), color: () => '#2ecc71' }]
      : [{ data: records.map((r) => r.weightKg ?? 0), color: () => '#9b59b6' }];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>30天趋势图</Text>
      <View style={styles.buttons}>
        <Button title="血压" onPress={() => setMetric('bloodPressure')} />
        <Button title="血糖" onPress={() => setMetric('bloodGlucose')} />
        <Button title="体重" onPress={() => setMetric('weightKg')} />
      </View>
      {records.length === 0 ? (
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  buttons: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  empty: { textAlign: 'center', marginTop: 32, color: '#888' },
});
```

- [ ] **Step 3: Verify the project still type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/screens/HistoryScreen.tsx mobile/src/screens/TrendsScreen.tsx
git commit -m "feat(mobile): add history and trends screens"
```

---

### Task 13: Login screen + Register screen

**Files:**
- Create: `mobile/src/screens/LoginScreen.tsx`
- Create: `mobile/src/screens/RegisterScreen.tsx`

**Interfaces:**
- Consumes: `RootStackParamList` (Task 8), `useAuth` (Task 9).
- Produces: default-exported `LoginScreen` and `RegisterScreen` components, wired into the navigator in Task 14.

- [ ] **Step 1: Create `mobile/src/screens/LoginScreen.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      Alert.alert('登录失败', '邮箱或密码不正确');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>登录</Text>
      <TextInput
        style={styles.input}
        placeholder="邮箱"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="密码"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title={submitting ? '登录中...' : '登录'} onPress={handleLogin} disabled={submitting} />
      <Button title="没有账号？去注册" onPress={() => navigation.navigate('Register')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
});
```

- [ ] **Step 2: Create `mobile/src/screens/RegisterScreen.tsx`**

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

- [ ] **Step 3: Verify the project still type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/screens/LoginScreen.tsx mobile/src/screens/RegisterScreen.tsx
git commit -m "feat(mobile): add login and register screens"
```

---

### Task 14: Navigator wiring + end-to-end verification

**Files:**
- Create: `mobile/src/navigation/AppNavigator.tsx`
- Modify: `mobile/App.tsx`

**Interfaces:**
- Consumes: every screen from Tasks 10–13, `RootStackParamList` (Task 8), `AuthProvider`/`useAuth` (Task 9).
- Produces: the fully wired app — final deliverable of Phase 1.

- [ ] **Step 1: Create `mobile/src/navigation/AppNavigator.tsx`**

```tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from './types';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import HomeScreen from '../screens/HomeScreen';
import DailyRecordScreen from '../screens/DailyRecordScreen';
import HistoryScreen from '../screens/HistoryScreen';
import TrendsScreen from '../screens/TrendsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {token ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: '首页' }} />
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} options={{ title: '健康档案' }} />
            <Stack.Screen name="DailyRecord" component={DailyRecordScreen} options={{ title: '今日记录' }} />
            <Stack.Screen name="History" component={HistoryScreen} options={{ title: '历史记录' }} />
            <Stack.Screen name="Trends" component={TrendsScreen} options={{ title: '趋势图' }} />
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

- [ ] **Step 2: Replace `mobile/App.tsx`**

```tsx
import React from 'react';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Verify the whole mobile project type-checks**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full mobile test suite**

Run (from `mobile/`): `npm test`
Expected: `bmi.test.ts` and `validators.test.ts` pass (4 passed).

- [ ] **Step 5: Set up a local database and run the backend**

From `backend/`:
1. Copy `.env.example` to `.env` and point `DATABASE_URL` at a running local PostgreSQL instance (e.g. `docker run --name happ-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=happ -p 5432:5432 -d postgres:16` if no local Postgres is installed).
2. Run `npx prisma migrate dev --name init` — expected: creates `users`, `health_profiles`, `daily_records` tables.
3. Run `npm run dev` — expected: `HAPP backend listening on port 3000`.

- [ ] **Step 6: Run the mobile app and manually verify the full Phase 1 flow**

From `mobile/`:
1. If testing on a physical device or a device emulator that can't reach `localhost` directly, update `API_BASE_URL` in `mobile/src/api/client.ts` to your machine's LAN IP (e.g. `http://192.168.1.20:3000`).
2. Run `npx expo start` and open the app in Expo Go or a simulator.
3. Register a new account → expect navigation to the health profile setup screen.
4. Fill in age/gender/height/weight and confirm the BMI updates live as you type → save → expect navigation to Home.
5. From Home, open "今日记录", fill in today's values, save → expect return to Home with no errors.
6. Open "历史记录" → expect today's entry to appear in the list.
7. Open "趋势图" → expect a line chart to render (even with a single data point) and switching between 血压/血糖/体重 to change the chart.
8. Log out from Home, then log back in with the same credentials → expect it to skip the profile setup screen and go straight to Home (since a profile already exists).

- [ ] **Step 7: Commit**

```bash
git add mobile/src/navigation/AppNavigator.tsx mobile/App.tsx
git commit -m "feat(mobile): wire navigation and complete Phase 1 end-to-end flow"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Module 1 (health profile + auto BMI) → Tasks 3, 6, 10. Module 2 (daily records) → Tasks 4, 7, 11. Module 4 (30-day trend chart) → Task 12 (`TrendsScreen`). Auth (prerequisite for all modules) → Tasks 5, 9, 13. Modules 3/5/6/7/8 are explicitly out of scope for this plan (Phase 2–4, see the design doc).
- **Type consistency:** `RootStackParamList` is defined once in `mobile/src/navigation/types.ts` (Task 8) and imported by every screen and by `AppNavigator.tsx` — no duplicate/conflicting definitions. `calculateBmi` and `validateDailyRecord` signatures are identical between `backend/src/utils/` and `mobile/src/utils/` by design (client mirrors server validation for instant feedback, server remains the source of truth).
- **No placeholders:** all steps contain complete, runnable code; no TODOs or "similar to Task N" references.
