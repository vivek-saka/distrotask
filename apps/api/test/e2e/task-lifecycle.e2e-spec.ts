import request from 'supertest';
import { createTestApp, closeTestApp, TestAppContext } from './test-app.helper';
import { registerAndLogin, authHeader, AuthenticatedTestUser } from './auth.helper';

describe('Task lifecycle (e2e)', () => {
  let ctx: TestAppContext;
  let user: AuthenticatedTestUser;
  const workerToken = process.env.WORKER_SERVICE_TOKEN!;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await registerAndLogin(ctx.app, 'task-lifecycle');
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  async function createTask(overrides: Partial<Record<string, unknown>> = {}) {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/tasks')
      .set(...authHeader(user.accessToken))
      .send({ name: 'Lifecycle task', type: 'email.send', payload: {}, ...overrides })
      .expect(201);
    return res.body.data;
  }

  describe('PATCH /api/v1/tasks/:id (update)', () => {
    it('updates a PENDING/QUEUED task', async () => {
      const task = await createTask({ name: 'Original name' });

      const res = await request(ctx.app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}`)
        .set(...authHeader(user.accessToken))
        .send({ name: 'Updated name' })
        .expect(200);

      expect(res.body.data.name).toBe('Updated name');
    });

    it('returns 404 when updating a non-existent task', async () => {
      await request(ctx.app.getHttpServer())
        .patch('/api/v1/tasks/00000000-0000-0000-0000-000000000000')
        .set(...authHeader(user.accessToken))
        .send({ name: 'Ghost' })
        .expect(404);
    });
  });

  describe('POST /api/v1/tasks/:id/cancel', () => {
    it('cancels a PENDING/QUEUED task', async () => {
      const task = await createTask();

      const res = await request(ctx.app.getHttpServer())
        .post(`/api/v1/tasks/${task.id}/cancel`)
        .set(...authHeader(user.accessToken))
        .expect(201);

      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('rejects cancelling an already-cancelled task', async () => {
      const task = await createTask();

      await request(ctx.app.getHttpServer())
        .post(`/api/v1/tasks/${task.id}/cancel`)
        .set(...authHeader(user.accessToken))
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/api/v1/tasks/${task.id}/cancel`)
        .set(...authHeader(user.accessToken))
        .expect(400);
    });
  });

  describe('Worker status-update callback -> Retry flow', () => {
    it('a worker can drive a task through RUNNING -> FAILED, then an operator can retry it', async () => {
      const task = await createTask();

      // Simulate the worker picking up the task.
      await request(ctx.app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}/status`)
        .set('x-worker-token', workerToken)
        .send({ status: 'RUNNING' })
        .expect(200);

      // Simulate the worker reporting a permanent failure (exhausted retries).
      const failedRes = await request(ctx.app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}/status`)
        .set('x-worker-token', workerToken)
        .send({ status: 'FAILED', errorMessage: 'boom', durationMs: 120 })
        .expect(200);

      expect(failedRes.body.data.status).toBe('FAILED');
      expect(failedRes.body.data.errorMessage).toBe('boom');

      // Operator retries the FAILED task via the public endpoint.
      const retryRes = await request(ctx.app.getHttpServer())
        .post(`/api/v1/tasks/${task.id}/retry`)
        .set(...authHeader(user.accessToken))
        .expect(201);

      expect(retryRes.body.data.status).toBe('QUEUED');
      expect(retryRes.body.data.retryCount).toBe(0); // manual retry resets the counter
      expect(retryRes.body.data.errorMessage).toBeNull();
    });

    it('rejects worker callbacks without a valid x-worker-token', async () => {
      const task = await createTask();

      await request(ctx.app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}/status`)
        .send({ status: 'RUNNING' })
        .expect(401);

      await request(ctx.app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}/status`)
        .set('x-worker-token', 'wrong-token')
        .send({ status: 'RUNNING' })
        .expect(401);
    });

    it('rejects retrying a task that has not failed yet (still PENDING)', async () => {
      const task = await createTask();

      await request(ctx.app.getHttpServer())
        .post(`/api/v1/tasks/${task.id}/retry`)
        .set(...authHeader(user.accessToken))
        .expect(400);
    });
  });

  describe('Task logs', () => {
    it('a worker can append log lines visible via GET /tasks/:id/logs', async () => {
      const task = await createTask();

      await request(ctx.app.getHttpServer())
        .post(`/api/v1/tasks/${task.id}/logs`)
        .set('x-worker-token', workerToken)
        .send({ level: 'INFO', message: 'Starting execution' })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/api/v1/tasks/${task.id}/logs`)
        .set('x-worker-token', workerToken)
        .send({ level: 'ERROR', message: 'Something went wrong', metadata: { code: 500 } })
        .expect(201);

      const logsRes = await request(ctx.app.getHttpServer())
        .get(`/api/v1/tasks/${task.id}/logs`)
        .set(...authHeader(user.accessToken))
        .expect(200);

      expect(logsRes.body.data).toHaveLength(2);
      expect(logsRes.body.data[0].message).toBe('Starting execution');
      expect(logsRes.body.data[1].metadata).toEqual({ code: 500 });
    });
  });

  describe('DELETE /api/v1/tasks/:id', () => {
    it('rejects deleting a non-terminal task', async () => {
      const task = await createTask();
      await request(ctx.app.getHttpServer())
        .delete(`/api/v1/tasks/${task.id}`)
        .set(...authHeader(user.accessToken))
        .expect(400);
    });

    it('deletes a task once it reaches a terminal state (CANCELLED)', async () => {
      const task = await createTask();

      await request(ctx.app.getHttpServer())
        .post(`/api/v1/tasks/${task.id}/cancel`)
        .set(...authHeader(user.accessToken))
        .expect(201);

      await request(ctx.app.getHttpServer())
        .delete(`/api/v1/tasks/${task.id}`)
        .set(...authHeader(user.accessToken))
        .expect(200);

      await request(ctx.app.getHttpServer())
        .get(`/api/v1/tasks/${task.id}`)
        .set(...authHeader(user.accessToken))
        .expect(404);
    });
  });
});
