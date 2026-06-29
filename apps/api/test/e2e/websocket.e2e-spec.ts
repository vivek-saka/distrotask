import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { WsEvent, WsRoom } from '@distrotask/shared';
import { createWsTestApp, closeWsTestApp, WsTestAppContext } from './ws-test-app.helper';
import { uniqueEmail } from './test-app.helper';

const workerToken = process.env.WORKER_SERVICE_TOKEN!;

/** Connects an authenticated socket and resolves once the server confirms connection. */
function connectSocket(wsUrl: string, accessToken: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(wsUrl, { auth: { token: accessToken }, transports: ['websocket'], forceNew: true });
    const timeout = setTimeout(() => reject(new Error('WS connection timed out')), 8000);

    socket.on(WsEvent.CONNECTED, () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/** Waits for a specific event on a socket, with a timeout so a missing event fails fast instead of hanging. */
function waitForEvent<T = unknown>(socket: Socket, event: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for WS event "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('WebSocket gateway (e2e)', () => {
  let ctx: WsTestAppContext;
  let accessToken: string;

  beforeAll(async () => {
    ctx = await createWsTestApp();

    const email = uniqueEmail('ws');
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'StrongPass1', firstName: 'WS', lastName: 'Tester' })
      .expect(201);
    accessToken = res.body.data.accessToken;
  });

  afterAll(async () => {
    await closeWsTestApp(ctx);
  });

  it('rejects a connection with no auth token', async () => {
    await expect(
      new Promise((resolve, reject) => {
        const socket = io(ctx.wsUrl, { transports: ['websocket'], forceNew: true });
        const timer = setTimeout(() => reject(new Error('expected disconnect, got timeout')), 5000);
        socket.on('disconnect', () => {
          clearTimeout(timer);
          resolve(undefined);
        });
        socket.on(WsEvent.CONNECTED, () => {
          clearTimeout(timer);
          reject(new Error('should not have connected without a token'));
        });
      }),
    ).resolves.toBeUndefined();
  });

  it('accepts a connection with a valid JWT and emits connection.established', async () => {
    const socket = await connectSocket(ctx.wsUrl, accessToken);
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });

  it('emits task.created when a task is created via the REST API', async () => {
    const socket = await connectSocket(ctx.wsUrl, accessToken);
    socket.emit(WsEvent.SUBSCRIBE, WsRoom.TASKS);
    await new Promise((r) => setTimeout(r, 200)); // let the room join land server-side

    const eventPromise = waitForEvent<{ task: { name: string } }>(socket, WsEvent.TASK_CREATED);

    await request(ctx.app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'WS-triggered task', type: 'email.send', payload: {} })
      .expect(201);

    const payload = await eventPromise;
    expect(payload.task.name).toBe('WS-triggered task');

    socket.disconnect();
  });

  it('emits task.status_changed when a worker reports COMPLETED via the status callback', async () => {
    const socket = await connectSocket(ctx.wsUrl, accessToken);
    socket.emit(WsEvent.SUBSCRIBE, WsRoom.TASKS);
    await new Promise((r) => setTimeout(r, 200));

    const createRes = await request(ctx.app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Completion task', type: 'email.send', payload: {} })
      .expect(201);
    const taskId = createRes.body.data.id;

    await request(ctx.app.getHttpServer())
      .patch(`/api/v1/tasks/${taskId}/status`)
      .set('x-worker-token', workerToken)
      .send({ status: 'RUNNING' })
      .expect(200);

    const eventPromise = waitForEvent<{ taskId: string; newStatus: string }>(socket, WsEvent.TASK_STATUS_CHANGED);

    await request(ctx.app.getHttpServer())
      .patch(`/api/v1/tasks/${taskId}/status`)
      .set('x-worker-token', workerToken)
      .send({ status: 'COMPLETED', result: { ok: true }, durationMs: 50 })
      .expect(200);

    const payload = await eventPromise;
    expect(payload.taskId).toBe(taskId);
    expect(payload.newStatus).toBe('COMPLETED');

    socket.disconnect();
  });

  it('emits worker.registered when a worker registers via the REST API', async () => {
    const socket = await connectSocket(ctx.wsUrl, accessToken);
    socket.emit(WsEvent.SUBSCRIBE, WsRoom.WORKERS);
    await new Promise((r) => setTimeout(r, 200));

    const eventPromise = waitForEvent<{ worker: { name: string } }>(socket, WsEvent.WORKER_REGISTERED);

    const workerName = `ws-e2e-worker-${Date.now()}`;
    await request(ctx.app.getHttpServer())
      .post('/api/v1/workers/register')
      .set('x-worker-token', workerToken)
      .send({ name: workerName, hostname: 'h', pid: 1, queues: ['*'], concurrency: 1 })
      .expect(201);

    const payload = await eventPromise;
    expect(payload.worker.name).toBe(workerName);

    socket.disconnect();
  });

  it('all connected clients automatically receive metrics.system on the broadcast interval', async () => {
    const socket = await connectSocket(ctx.wsUrl, accessToken);
    // No explicit SUBSCRIBE needed — handleConnection auto-joins WsRoom.METRICS.
    const payload = await waitForEvent<{ totalTasks: number; timestamp: string }>(
      socket,
      WsEvent.METRICS_SYSTEM,
      10000, // broadcaster runs every 5s; give it two cycles of headroom
    );

    expect(payload).toEqual(
      expect.objectContaining({ totalTasks: expect.any(Number), timestamp: expect.any(String) }),
    );

    socket.disconnect();
  });
});
