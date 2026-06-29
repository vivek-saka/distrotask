import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CancelTaskHandler, CancelTaskCommand } from '../commands/cancel-task.command';
import { TaskStatus, TaskPriority } from '@distrotask/shared';

describe('CancelTaskHandler', () => {
  let prisma: any;
  let eventBus: any;
  let handler: CancelTaskHandler;

  const makeTaskRow = (status: TaskStatus) => ({
    id: 'task-1',
    name: 'Task',
    type: 'email.send',
    payload: {},
    result: null,
    status,
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
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    prisma = { task: { findUnique: jest.fn(), update: jest.fn() } };
    eventBus = { publish: jest.fn() };
    handler = new CancelTaskHandler(prisma, eventBus);
  });

  it('throws NotFoundException when the task does not exist', async () => {
    prisma.task.findUnique.mockResolvedValue(null);
    await expect(handler.execute(new CancelTaskCommand('missing'))).rejects.toThrow(NotFoundException);
  });

  it('cancels a RUNNING task', async () => {
    prisma.task.findUnique.mockResolvedValue(makeTaskRow(TaskStatus.RUNNING));
    prisma.task.update.mockResolvedValue(makeTaskRow(TaskStatus.CANCELLED));

    const result = await handler.execute(new CancelTaskCommand('task-1'));

    expect(result.status).toBe(TaskStatus.CANCELLED);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('rejects cancelling an already-COMPLETED task', async () => {
    prisma.task.findUnique.mockResolvedValue(makeTaskRow(TaskStatus.COMPLETED));

    await expect(handler.execute(new CancelTaskCommand('task-1'))).rejects.toThrow(BadRequestException);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('rejects cancelling an already-CANCELLED task', async () => {
    prisma.task.findUnique.mockResolvedValue(makeTaskRow(TaskStatus.CANCELLED));

    await expect(handler.execute(new CancelTaskCommand('task-1'))).rejects.toThrow(BadRequestException);
  });
});
