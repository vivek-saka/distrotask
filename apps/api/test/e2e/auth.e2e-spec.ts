import request from 'supertest';
import { createTestApp, closeTestApp, uniqueEmail, TestAppContext } from './test-app.helper';

describe('Auth flow (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user and returns an access/refresh token pair', async () => {
      const email = uniqueEmail('register');

      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'StrongPass1', firstName: 'Ada', lastName: 'Lovelace' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: expect.objectContaining({ email, firstName: 'Ada', lastName: 'Lovelace' }),
      });
    });

    it('rejects a duplicate email with 409 Conflict', async () => {
      const email = uniqueEmail('duplicate');

      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'StrongPass1', firstName: 'A', lastName: 'B' })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'StrongPass1', firstName: 'A', lastName: 'B' })
        .expect(409);
    });

    it('rejects a weak password failing the complexity regex', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: uniqueEmail('weak'), password: 'alllowercase', firstName: 'A', lastName: 'B' })
        .expect(400);
    });

    it('rejects a malformed email', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'StrongPass1', firstName: 'A', lastName: 'B' })
        .expect(400);
    });

    it('rejects unknown extra fields (forbidNonWhitelisted)', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail('extra'),
          password: 'StrongPass1',
          firstName: 'A',
          lastName: 'B',
          isAdmin: true, // not part of RegisterDto — should be rejected, not silently dropped
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const email = uniqueEmail('login');
    const password = 'StrongPass1';

    beforeAll(async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password, firstName: 'Login', lastName: 'Test' })
        .expect(201);
    });

    it('logs in with correct credentials', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);

      expect(response.body.data.accessToken).toEqual(expect.any(String));
    });

    it('rejects an incorrect password with 401', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword1' })
        .expect(401);
    });

    it('rejects a non-existent email with 401 (not 404 — avoids user enumeration)', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: uniqueEmail('nonexistent'), password: 'StrongPass1' })
        .expect(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns the authenticated user profile when given a valid bearer token', async () => {
      const email = uniqueEmail('me');
      const registerRes = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'StrongPass1', firstName: 'Profile', lastName: 'Owner' })
        .expect(201);

      const { accessToken } = registerRes.body.data;

      const meRes = await request(ctx.app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(meRes.body.data.email).toBe(email);
    });

    it('rejects a request with no Authorization header (401)', async () => {
      await request(ctx.app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('rejects a request with a malformed/garbage token (401)', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-a-real-jwt')
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('exchanges a valid refresh token for a new token pair', async () => {
      const email = uniqueEmail('refresh');
      const registerRes = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'StrongPass1', firstName: 'Refresh', lastName: 'Flow' })
        .expect(201);

      const { refreshToken } = registerRes.body.data;

      const refreshRes = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshRes.body.data.accessToken).toEqual(expect.any(String));
      expect(refreshRes.body.data.refreshToken).not.toBe(refreshToken); // rotated
    });

    it('rejects an already-rotated (reused) refresh token', async () => {
      const email = uniqueEmail('reuse');
      const registerRes = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'StrongPass1', firstName: 'Reuse', lastName: 'Flow' })
        .expect(201);

      const { refreshToken } = registerRes.body.data;

      // First use rotates the token successfully.
      await request(ctx.app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken }).expect(200);

      // Re-using the now-stale token must be rejected (theft/replay detection).
      await request(ctx.app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('rejects a garbage refresh token', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'garbage-token' })
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('revokes the refresh token so it can no longer be used', async () => {
      const email = uniqueEmail('logout');
      const registerRes = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'StrongPass1', firstName: 'Logout', lastName: 'Flow' })
        .expect(201);

      const { accessToken, refreshToken } = registerRes.body.data;

      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(ctx.app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
    });
  });
});
