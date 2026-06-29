import request from 'supertest';
import { createTestApp, closeTestApp, TestAppContext } from './test-app.helper';
import { registerAndLogin, authHeader, AuthenticatedTestUser } from './auth.helper';

describe('Worker registration & heartbeat (e2e)', () => {
  let ctx: TestAppContext;
  let user: AuthenticatedTestUser;
  const workerToken = process.env.WORKER_SERVICE_TOKEN!;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await registerAndLogin(ctx.app, 'worker-fleet');
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  function uniqueWorkerName() {
    return `e2e-worker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }

  describe('POST /api/v1/workers/register', () => {
    it('registers a new worker and marks it ONLINE', async () => {
      const name = uniqueWorkerName();

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/workers/register')
        .set('x-worker-token', workerToken)
        .send({
          name,
          hostname: 'test-host',
          pid: 1234,
          queues: ['email.send', 'report.generate'],
          concurrency: 5,
          version: '1.0.0',
        })
        .expect(201);

      expect(res.body.data).toMatchObject({ name, status: 'ONLINE', concurrency: 5 });
    });

    it('upserts (re-registers) a worker with the same name rather than duplicating it', async () => {
      const name = uniqueWorkerName();

      const first = await request(ctx.app.getHttpServer())
        .post('/api/v1/workers/register')
        .set('x-worker-token', workerToken)
        .send({ name, hostname: 'host-a', pid: 100, queues: ['*'], concurrency: 3 })
        .expect(201);

      const second = await request(ctx.app.getHttpServer())
        .post('/api/v1/workers/register')
        .set('x-worker-token', workerToken)
        .send({ name, hostname: 'host-b', pid: 200, queues: ['*'], concurrency: 8 })
        .expect(201);

      expect(second.body.data.id).toBe(first.body.data.id);
      expect(second.body.data.concurrency).toBe(8);
      expect(second.body.data.pid).toBe(200);
    });

    it('rejects registration without a valid worker token', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/workers/register')
        .send({ name: uniqueWorkerName(), hostname: 'h', pid: 1, queues: ['*'], concurrency: 1 })
        .expect(401);
    });

    it('rejects registration missing required fields', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/workers/register')
        .set('x-worker-token', workerToken)
        .send({ name: uniqueWorkerName() }) // missing hostname/pid/queues/concurrency
        .expect(400);
    });
  });

  describe('POST /api/v1/workers/:id/heartbeat', () => {
    it('updates lastHeartbeatAt and currentTaskCount, flips status to BUSY when tasks > 0', async () => {
      const name = uniqueWorkerName();
      const registerRes = await request(ctx.app.getHttpServer())
        .post('/api/v1/workers/register')
        .set('x-worker-token', workerToken)
        .send({ name, hostname: 'h', pid: 1, queues: ['*'], concurrency: 5 })
        .expect(201);

      const workerId = registerRes.body.data.id;

      const heartbeatRes = await request(ctx.app.getHttpServer())
        .post(`/api/v1/workers/${workerId}/heartbeat`)
        .set('x-worker-token', workerToken)
        .send({ currentTaskCount: 3, cpuUsagePercent: 12.5, memoryUsageMb: 256 })
        .expect(201);

      expect(heartbeatRes.body.data.currentTaskCount).toBe(3);
      expect(heartbeatRes.body.data.status).toBe('BUSY');
    });

    it('flips status to IDLE when currentTaskCount is 0', async () => {
      const name = uniqueWorkerName();
      const registerRes = await request(ctx.app.getHttpServer())
        .post('/api/v1/workers/register')
        .set('x-worker-token', workerToken)
        .send({ name, hostname: 'h', pid: 1, queues: ['*'], concurrency: 5 })
        .expect(201);

      const heartbeatRes = await request(ctx.app.getHttpServer())
        .post(`/api/v1/workers/${registerRes.body.data.id}/heartbeat`)
        .set('x-worker-token', workerToken)
        .send({ currentTaskCount: 0 })
        .expect(201);

      expect(heartbeatRes.body.data.status).toBe('IDLE');
    });

    it('returns 404 for a heartbeat on a worker id that does not exist', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/workers/00000000-0000-0000-0000-000000000000/heartbeat')
        .set('x-worker-token', workerToken)
        .send({ currentTaskCount: 0 })
        .expect(404);
    });
  });

  describe('GET /api/v1/workers (public, authenticated reads)', () => {
    it('lists registered workers for an authenticated user', async () => {
      const name = uniqueWorkerName();
      await request(ctx.app.getHttpServer())
        .post('/api/v1/workers/register')
        .set('x-worker-token', workerToken)
        .send({ name, hostname: 'h', pid: 1, queues: ['*'], concurrency: 1 })
        .expect(201);

      const listRes = await request(ctx.app.getHttpServer())
        .get('/api/v1/workers')
        .set(...authHeader(user.accessToken))
        .expect(200);

      const names = listRes.body.data.map((w: { name: string }) => w.name);
      expect(names).toContain(name);
    });

    it('rejects listing workers without authentication', async () => {
      await request(ctx.app.getHttpServer()).get('/api/v1/workers').expect(401);
    });

    it('GET /api/v1/workers/active-count returns active and total counts', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/workers/active-count')
        .set(...authHeader(user.accessToken))
        .expect(200);

      expect(res.body.data).toEqual(
        expect.objectContaining({ active: expect.any(Number), total: expect.any(Number) }),
      );
      expect(res.body.data.total).toBeGreaterThanOrEqual(res.body.data.active);
    });
  });
});
