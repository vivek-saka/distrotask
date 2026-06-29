import { CreateTaskHandler, CreateTaskCommand } from '../commands/create-task.command';
import { TaskPriority, TaskStatus } from '@distrotask/shared';

describe('CreateTaskHandler', () => {
  let prisma: any;
  let producer: any;
  let eventBus: any;
  let handler: CreateTaskHandler;

  const baseTaskRow = {
    id: 'task-1',
    name: 'Send welcome email',
    type: 'email.send',
    payload: { to: 'user@example.com' },
    result: null,
    status: TaskStatus.PENDING,
    priority: TaskPriority.NORMAL,
    queueName: 'default',
    maxRetries: 3,
    retryCount: 0,
    backoffStrategy: 'exponential',
    nextRetryAt: null,
    errorMessage: null,
    errorStack: null,
    createdById: 'user-1',
    workerId: null,
    scheduleId: null,
    queuedAt: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    idempotencyKey: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      task: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue(baseTaskRow),
        update: jest.fn().mockResolvedValue({
          ...baseTaskRow,
          status: TaskStatus.QUEUED,
          queuedAt: new Date('2026-01-01T00:00:01Z'),
        }),
      },
    };
    producer = { publishTask: jest.fn().mockResolvedValue(undefined) };
    eventBus = { publish: jest.fn() };
    handler = new CreateTaskHandler(prisma, producer, eventBus);
  });

  it('creates a PENDING task row, publishes it to the broker, then flips to QUEUED', async () => {
    const command = new CreateTaskCommand(
      'user-1',
      'Send welcome email',
      'email.send',
      { to: 'user@example.com' },
      TaskPriority.NORMAL,
    );

    const result = await handler.execute(command);

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: TaskStatus.PENDING, type: 'email.send' }),
      }),
    );
    expect(producer.publishTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-1', type: 'email.send', attempt: 1 }),
    );
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1' },
        data: expect.objectContaining({ status: TaskStatus.QUEUED }),
      }),
    );
    expect(result.status).toBe(TaskStatus.QUEUED);
  });

  it('publishes a TaskCreatedEvent and a TaskStatusChangedEvent on the event bus', async () => {
    const command = new CreateTaskCommand('user-1', 'Send welcome email', 'email.send', {});
    await handler.execute(command);

    expect(eventBus.publish).toHaveBeenCalledTimes(2);
  });

  it('short-circuits and returns the existing task when idempotencyKey already exists', async () => {
    prisma.task.findUnique.mockResolvedValue(baseTaskRow);

    const command = new CreateTaskCommand(
      'user-1',
      'Send welcome email',
      'email.send',
      {},
      undefined,
      undefined,
      undefined,
      'idem-key-123',
    );

    const result = await handler.execute(command);

    expect(prisma.task.create).not.toHaveBeenCalled();
    expect(producer.publishTask).not.toHaveBeenCalled();
    expect(result.id).toBe('task-1');
  });

  it('leaves the task in PENDING and does not throw if the broker publish fails', async () => {
    producer.publishTask.mockRejectedValue(new Error('broker unreachable'));

    const command = new CreateTaskCommand('user-1', 'Send welcome email', 'email.send', {});
    const result = await handler.execute(command);

    expect(prisma.task.update).not.toHaveBeenCalled();
    expect(result.status).toBe(TaskStatus.PENDING);
  });

  it('defaults priority to NORMAL and maxRetries to 3 when not specified', async () => {
    const command = new CreateTaskCommand('user-1', 'Task', 'email.send', {});
    await handler.execute(command);

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: TaskPriority.NORMAL, maxRetries: 3 }),
      }),
    );
  });
});
