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
