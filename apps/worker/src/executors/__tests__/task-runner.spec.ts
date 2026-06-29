import { TaskRunner } from '../task-runner';
import { executorRegistry } from '../executor-registry';
import { TaskJobMessage, TaskPriority, TaskStatus, TaskLogLevel } from '@distrotask/shared';

describe('TaskRunner (worker integration)', () => {
  let apiClient: any;
  let runner: TaskRunner;

  beforeEach(() => {
    apiClient = {
      updateTaskStatus: jest.fn().mockResolvedValue(undefined),
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    runner = new TaskRunner(apiClient, 'worker-123');
  });

  function makeMessage(type: string, overrides: Partial<TaskJobMessage> = {}): TaskJobMessage {
    return {
      taskId: 'task-abc',
      type,
      payload: {},
      priority: TaskPriority.NORMAL,
      attempt: 1,
      maxRetries: 3,
      enqueuedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it('reports RUNNING then COMPLETED for a successful executor', async () => {
    const type = 'test.success.' + Date.now();
    executorRegistry.register(type, async (_payload, ctx) => {
      await ctx.log('doing work');
      return { ok: true };
    });

    const result = await runner.run(makeMessage(type));

    expect(result.outcome).toBe('completed');
    expect(apiClient.updateTaskStatus).toHaveBeenNthCalledWith(1, 'task-abc', TaskStatus.RUNNING, {
      workerId: 'worker-123',
    });
    expect(apiClient.updateTaskStatus).toHaveBeenNthCalledWith(
      2,
      'task-abc',
      TaskStatus.COMPLETED,
      expect.objectContaining({ result: { ok: true } }),
    );
    expect(apiClient.appendLog).toHaveBeenCalledWith('task-abc', TaskLogLevel.INFO, 'doing work', undefined);
  });

  it('reports FAILED immediately when no executor is registered for the task type', async () => {
    const result = await runner.run(makeMessage('test.unregistered.' + Date.now()));

    expect(result.outcome).toBe('failed');
    expect(apiClient.updateTaskStatus).toHaveBeenLastCalledWith(
      'task-abc',
      TaskStatus.FAILED,
      expect.objectContaining({ errorMessage: expect.stringContaining('No executor registered') }),
    );
  });

  it('reports RETRYING when the executor throws and attempts remain', async () => {
    const type = 'test.transient-failure.' + Date.now();
    executorRegistry.register(type, async () => {
      throw new Error('temporary glitch');
    });

    const result = await runner.run(makeMessage(type, { attempt: 1, maxRetries: 3 }));

    expect(result.outcome).toBe('retrying');
    expect(apiClient.updateTaskStatus).toHaveBeenLastCalledWith(
      'task-abc',
      TaskStatus.RETRYING,
      expect.objectContaining({ errorMessage: 'temporary glitch' }),
    );
  });

  it('reports FAILED (not RETRYING) when the executor throws on the final allowed attempt', async () => {
    const type = 'test.final-failure.' + Date.now();
    executorRegistry.register(type, async () => {
      throw new Error('still broken');
    });

    const result = await runner.run(makeMessage(type, { attempt: 3, maxRetries: 3 }));

    expect(result.outcome).toBe('failed');
    expect(apiClient.updateTaskStatus).toHaveBeenLastCalledWith(
      'task-abc',
      TaskStatus.FAILED,
      expect.objectContaining({ errorMessage: 'still broken' }),
    );
  });

  it('logs the error message via appendLog before reporting a failure', async () => {
    const type = 'test.logged-failure.' + Date.now();
    executorRegistry.register(type, async () => {
      throw new Error('logged failure case');
    });

    await runner.run(makeMessage(type, { attempt: 1, maxRetries: 1 }));

    expect(apiClient.appendLog).toHaveBeenCalledWith('task-abc', TaskLogLevel.ERROR, 'logged failure case');
  });

  it('passes the configured payload through to the executor unchanged', async () => {
    const type = 'test.payload-passthrough.' + Date.now();
    let receivedPayload: unknown;
    executorRegistry.register(type, async (payload) => {
      receivedPayload = payload;
    });

    await runner.run(makeMessage(type, { payload: { to: 'someone@example.com', count: 3 } }));

    expect(receivedPayload).toEqual({ to: 'someone@example.com', count: 3 });
  });
});
