import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { AUTH_RATE_LIMIT_MAX } from '../src/middleware/rateLimit';

jest.mock('../src/db', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as { user: { findUnique: jest.Mock } };

describe('auth rate limiting', () => {
  it('allows requests up to the configured max, then blocks with 429', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    for (let i = 0; i < AUTH_RATE_LIMIT_MAX; i++) {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'x' });
      expect(res.status).toBe(401);
    }

    const blocked = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'x' });
    expect(blocked.status).toBe(429);
  });
});
