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
    expect(mockedPrisma.dailyRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_recordDate: { userId: 'user-1', recordDate: new Date('2026-07-12') } },
      })
    );
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
    expect(mockedPrisma.dailyRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { recordDate: 'asc' },
      })
    );
  });
});
