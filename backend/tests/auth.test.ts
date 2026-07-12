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
