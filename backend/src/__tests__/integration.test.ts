import request from 'supertest';
import app from '../index';

/**
 * Integration tests for key API endpoints.
 *
 * NOTE:
 * - These tests assume that:
 *   - PostgreSQL is available and DATABASE_URL is configured.
 *   - Redis is available and related env vars are configured.
 *   - Prisma migrations and seed have been run (demo users exist).
 * - In CI, make sure to run migrations + seed before `npm test`.
 */

describe('Health endpoints', () => {
  it('GET /health should return basic ok status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/health should include services statuses', async () => {
    const res = await request(app).get('/api/health');

    // If database / redis are down, service may respond with 503.
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('services');
    expect(res.body.services).toHaveProperty('database');
    expect(res.body.services).toHaveProperty('redis');
  });
});

describe('Auth flow and protected routes', () => {
  /**
   * These tests rely on demo users created by prisma/seed.ts:
   * - ADMIN: admin@ftr.ru / admin123
   */
  const adminCredentials = {
    email: 'admin@ftr.ru',
    password: 'admin123',
  };

  it('POST /api/auth/login should authenticate demo admin user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(adminCredentials);

    // If seed data is missing, fail with a clear message to simplify debugging.
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toMatchObject({
      email: adminCredentials.email,
      role: 'ADMIN',
    });
  });

  it('GET /api/auth/me should return current user when authorized', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send(adminCredentials);

    expect(loginRes.status).toBe(200);
    const token: string = loginRes.body.accessToken;
    expect(typeof token).toBe('string');

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body).toMatchObject({
      email: adminCredentials.email,
      role: 'ADMIN',
    });
  });

  it('GET /api/registrations should return 401 without token', async () => {
    const res = await request(app).get('/api/registrations');

    expect(res.status).toBe(401);
  });

  it('GET /api/registrations should return 200 with valid token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send(adminCredentials);

    expect(loginRes.status).toBe(200);
    const token: string = loginRes.body.accessToken;
    expect(typeof token).toBe('string');

    const res = await request(app)
      .get('/api/registrations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('registrations');
    expect(res.body).toHaveProperty('pagination');
  });
});


