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
