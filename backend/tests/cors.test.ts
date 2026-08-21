import request from 'supertest';

describe('CORS configuration', () => {
  const ORIGINAL_ENV = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = ORIGINAL_ENV;
    }
    jest.resetModules();
  });

  it('reflects any origin when CORS_ORIGIN is unset (dev default)', async () => {
    delete process.env.CORS_ORIGIN;
    jest.resetModules();
    const { app } = require('../src/app');

    const res = await request(app).get('/health').set('Origin', 'http://example.com');
    expect(res.headers['access-control-allow-origin']).toBe('http://example.com');
  });

  it('only allows the configured origin(s) when CORS_ORIGIN is set', async () => {
    process.env.CORS_ORIGIN = 'https://app.example.com';
    jest.resetModules();
    const { app } = require('../src/app');

    const allowed = await request(app).get('/health').set('Origin', 'https://app.example.com');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.example.com');

    const blocked = await request(app).get('/health').set('Origin', 'https://evil.example.com');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});
