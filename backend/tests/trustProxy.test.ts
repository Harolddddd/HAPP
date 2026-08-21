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

function loginAs(clientIp: string) {
  return request(app)
    .post('/auth/login')
    .set('X-Forwarded-For', clientIp)
    .send({ email: 'nobody@example.com', password: 'x' });
}

describe('rate limiting behind the Nginx reverse proxy', () => {
  it('trusts loopback proxies only, so X-Forwarded-For cannot be spoofed by remote clients', () => {
    expect(app.get('trust proxy')).toBe('loopback');
  });

  it('gives each forwarded client IP its own rate-limit budget', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    // Exhaust one client's entire budget.
    for (let i = 0; i < AUTH_RATE_LIMIT_MAX; i++) {
      const res = await loginAs('203.0.113.10');
      expect(res.status).toBe(401);
    }
    const blocked = await loginAs('203.0.113.10');
    expect(blocked.status).toBe(429);

    // A different client behind the same proxy must be unaffected. Without
    // `trust proxy`, req.ip would be the proxy's loopback address for both and
    // this request would also be a 429.
    const other = await loginAs('203.0.113.11');
    expect(other.status).toBe(401);
  });
});
