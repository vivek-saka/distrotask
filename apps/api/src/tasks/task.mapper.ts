import { Task } from '@prisma/client';
import { TaskDto } from '@distrotask/shared';

export function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    name: task.name,
    type: task.type,
    payload: task.payload as Record<string, unknown>,
    result: task.result as Record<string, unknown> | null,
    status: task.status as TaskDto['status'],
    priority: task.priority as TaskDto['priority'],
    queueName: task.queueName,
    maxRetries: task.maxRetries,
    retryCount: task.retryCount,
    backoffStrategy: task.backoffStrategy,
    nextRetryAt: task.nextRetryAt?.toISOString() ?? null,
    errorMessage: task.errorMessage,
    createdById: task.createdById,
    workerId: task.workerId,
    scheduleId: task.scheduleId,
    queuedAt: task.queuedAt?.toISOString() ?? null,
    startedAt: task.startedAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    durationMs: task.durationMs,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
