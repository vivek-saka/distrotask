import request from 'supertest';
import { createTestApp, closeTestApp, TestAppContext } from './test-app.helper';
import { registerAndLogin, authHeader, AuthenticatedTestUser } from './auth.helper';

describe('Monitoring endpoints (e2e)', () => {
  let ctx: TestAppContext;
  let user: AuthenticatedTestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await registerAndLogin(ctx.app, 'monitoring');
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('GET /api/v1/health', () => {
    it('is publicly reachable without authentication and reports DB connectivity', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/api/v1/health').expect(200);

      expect(res.body.data).toEqual(
        expect.objectContaining({
          status: expect.stringMatching(/^(ok|degraded)$/),
          uptime: expect.any(Number),
          dependencies: expect.objectContaining({ database: expect.stringMatching(/^(up|down)$/) }),
        }),
      );
    });
  });

  describe('GET /api/v1/monitoring/prometheus', () => {
    it('is publicly reachable and returns raw text-exposition format, not the JSON envelope', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/api/v1/monitoring/prometheus').expect(200);

      // Critically: this must NOT be wrapped in { success, data, timestamp } —
      // Prometheus's scraper cannot parse JSON. Asserting the raw shape here
      // guards against a regression of the TransformInterceptor SkipTransform bug.
      expect(res.body).not.toHaveProperty('success');
      expect(res.text).toEqual(expect.stringContaining('distrotask_'));
      expect(res.headers['content-type']).toMatch(/text\/plain/);
    });

    it('includes the expected custom metric names', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/api/v1/monitoring/prometheus').expect(200);

      expect(res.text).toContain('distrotask_http_request_duration_seconds');
      expect(res.text).toContain('distrotask_tasks_created_total');
      expect(res.text).toContain('distrotask_active_workers');
    });
  });

  describe('GET /api/v1/monitoring/system', () => {
    it('requires authentication', async () => {
      await request(ctx.app.getHttpServer()).get('/api/v1/monitoring/system').expect(401);
    });

    it('returns a full system metrics snapshot with consistent counts', async () => {
      // Seed at least one task so totals are non-trivially verifiable.
      await request(ctx.app.getHttpServer())
        .post('/api/v1/tasks')
        .set(...authHeader(user.accessToken))
        .send({ name: 'Metrics seed task', type: 'email.send', payload: {} })
        .expect(201);

      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/monitoring/system')
        .set(...authHeader(user.accessToken))
        .expect(200);

      const m = res.body.data;
      expect(m).toEqual(
        expect.objectContaining({
          totalTasks: expect.any(Number),
          pendingCount: expect.any(Number),
          queuedCount: expect.any(Number),
          runningCount: expect.any(Number),
          completedCount: expect.any(Number),
          failedCount: expect.any(Number),
          successRate: expect.any(Number),
          failureRate: expect.any(Number),
          activeWorkerCount: expect.any(Number),
          totalWorkerCount: expect.any(Number),
          timestamp: expect.any(String),
        }),
      );
      expect(m.totalTasks).toBeGreaterThan(0);

      // Status counts must never exceed the total (sanity bound on the aggregation query).
      const sumOfStatuses =
        m.pendingCount +
        m.queuedCount +
        m.runningCount +
        m.completedCount +
        m.failedCount +
        m.retryingCount +
        m.cancelledCount +
        m.deadLetteredCount;
      expect(sumOfStatuses).toBeLessThanOrEqual(m.totalTasks);
    });
  });

  describe('GET /api/v1/monitoring/queues', () => {
    it('requires authentication', async () => {
      await request(ctx.app.getHttpServer()).get('/api/v1/monitoring/queues').expect(401);
    });

    it('returns queue depth for all four priority queues plus DLQ depth', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/monitoring/queues')
        .set(...authHeader(user.accessToken))
        .expect(200);

      expect(res.body.data).toEqual(
        expect.objectContaining({
          queues: expect.any(Array),
          deadLetterDepth: expect.any(Number),
        }),
      );
      expect(res.body.data.queues).toHaveLength(4);
      for (const q of res.body.data.queues) {
        expect(q).toEqual(
          expect.objectContaining({
            queueName: expect.any(String),
            depth: expect.any(Number),
            consumerCount: expect.any(Number),
          }),
        );
      }
    });
  });
});
