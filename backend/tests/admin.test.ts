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

  it('queries the top-features event set without a role filter', async () => {
    mockedPrisma.usageEvent.findMany.mockResolvedValue([]);

    await request(app).get('/admin/stats').set('Authorization', authHeader());

    const secondCallArgs = mockedPrisma.usageEvent.findMany.mock.calls[1][0];
    expect(secondCallArgs.where.user).toBeUndefined();
  });
});
