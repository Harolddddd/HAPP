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
