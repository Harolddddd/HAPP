import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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

describe('POST /auth/register role handling', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defaults to patient when role is omitted', async () => {
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
    expect(res.body.user.role).toBe('patient');
  });

  it('creates a doctor account when role is doctor', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.user.create.mockResolvedValue({
      id: 'doc-1',
      email: 'doc@example.com',
      name: 'Dr. Smith',
      role: 'doctor',
      passwordHash: 'hashed',
    });

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'doc@example.com', password: 'password123', name: 'Dr. Smith', role: 'doctor' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('doctor');
  });

  it('rejects an invalid role with 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'a@example.com', password: 'password123', name: 'Alice', role: 'admin' });

    expect(res.status).toBe(400);
  });
});

describe('GET /auth/me', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      name: 'Alice',
      role: 'patient',
      passwordHash: 'hashed',
    });

    const token = jwt.sign({ userId: 'user-1', role: 'patient' }, process.env.JWT_SECRET || 'dev-secret');
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'user-1', email: 'a@example.com', name: 'Alice', role: 'patient' });
  });

  it('returns 404 when the user no longer exists', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const token = jwt.sign({ userId: 'ghost', role: 'patient' }, process.env.JWT_SECRET || 'dev-secret');
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
