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
