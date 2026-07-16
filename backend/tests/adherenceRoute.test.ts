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
