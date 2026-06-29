import request from 'supertest';
import { createTestApp, closeTestApp, TestAppContext } from './test-app.helper';
import { registerAndLogin, authHeader, AuthenticatedTestUser } from './auth.helper';

describe('Task creation flow (e2e)', () => {
  let ctx: TestAppContext;
  let user: AuthenticatedTestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await registerAndLogin(ctx.app, 'task-create');
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  it('creates a task and the response reflects PENDING or QUEUED status', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/tasks')
      .set(...authHeader(user.accessToken))
      .send({ name: 'Send welcome email', type: 'email.send', payload: { to: 'a@b.com' } })
      .expect(201);

    expect(res.body.data).toMatchObject({
      name: 'Send welcome email',
      type: 'email.send',
      createdById: user.userId,
    });
    // Depending on whether RabbitMQ is reachable in the test environment,
    // the task lands as QUEUED (broker reachable) or PENDING (broker publish
    // failed, durable row still persisted) — both are correct per the
    // documented dual-write tradeoff in create-task.command.ts.
    expect(['PENDING', 'QUEUED']).toContain(res.body.data.status);
  });

  it('defaults priority to NORMAL and maxRetries to 3 when omitted', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/tasks')
      .set(...authHeader(user.accessToken))
      .send({ name: 'Default priority task', type: 'email.send', payload: {} })
      .expect(201);

    expect(res.body.data.priority).toBe('NORMAL');
    expect(res.body.data.maxRetries).toBe(3);
  });

  it('respects an explicit CRITICAL priority and custom maxRetries', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/tasks')
      .set(...authHeader(user.accessToken))
      .send({
        name: 'Urgent task',
        type: 'webhook.deliver',
        payload: { url: 'https://example.com/hook' },
        priority: 'CRITICAL',
        maxRetries: 5,
      })
      .expect(201);

    expect(res.body.data.priority).toBe('CRITICAL');
    expect(res.body.data.maxRetries).toBe(5);
  });

  it('rejects a request missing the required "type" field', async () => {
    await request(ctx.app.getHttpServer())
      .post('/api/v1/tasks')
      .set(...authHeader(user.accessToken))
      .send({ name: 'No type', payload: {} })
      .expect(400);
  });

  it('rejects a request with a non-object payload', async () => {
    await request(ctx.app.getHttpServer())
      .post('/api/v1/tasks')
      .set(...authHeader(user.accessToken))
      .send({ name: 'Bad payload', type: 'email.send', payload: 'not-an-object' })
      .expect(400);
  });

  it('rejects an invalid priority enum value', async () => {
    await request(ctx.app.getHttpServer())
      .post('/api/v1/tasks')
      .set(...authHeader(user.accessToken))
      .send({ name: 'Bad priority', type: 'email.send', payload: {}, priority: 'SUPER_URGENT' })
      .expect(400);
  });

  it('rejects creation without authentication', async () => {
    await request(ctx.app.getHttpServer())
      .post('/api/v1/tasks')
      .send({ name: 'Unauthed', type: 'email.send', payload: {} })
      .expect(401);
  });

  it('is idempotent: a repeated idempotencyKey returns the original task instead of creating a duplicate', async () => {
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const first = await request(ctx.app.getHttpServer())
      .post('/api/v1/tasks')
      .set(...authHeader(user.accessToken))
      .send({ name: 'Idempotent task', type: 'email.send', payload: {}, idempotencyKey })
      .expect(201);

    const second = await request(ctx.app.getHttpServer())
      .post('/api/v1/tasks')
      .set(...authHeader(user.accessToken))
      .send({ name: 'Idempotent task — different name', type: 'email.send', payload: {}, idempotencyKey })
      .expect(201);

    expect(second.body.data.id).toBe(first.body.data.id);
    // The second call's "different name" must NOT have overwritten the original.
    expect(second.body.data.name).toBe('Idempotent task');
  });

  it('newly created task appears in the task list', async () => {
    const created = await request(ctx.app.getHttpServer())
      .post('/api/v1/tasks')
      .set(...authHeader(user.accessToken))
      .send({ name: 'Listable task', type: 'report.generate', payload: {} })
      .expect(201);

    const list = await request(ctx.app.getHttpServer())
      .get('/api/v1/tasks')
      .query({ search: 'Listable task' })
      .set(...authHeader(user.accessToken))
      .expect(200);

    const ids = list.body.data.data.map((t: { id: string }) => t.id);
    expect(ids).toContain(created.body.data.id);
  });
});
