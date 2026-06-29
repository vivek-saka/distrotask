import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { BadRequestException, Inject, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TaskProducer } from '@distrotask/rabbitmq';
import {
  TaskStatus,
  TaskPriority,
  TaskJobMessage,
  canTransition,
  computeBackoffDelayMs,
} from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';
import { TASK_PRODUCER } from '../../queue/queue.module';
import { toTaskDto } from '../task.mapper';
import { TaskStatusChangedEvent } from '../events/task.events';

interface StatusUpdatePayload {
  workerId?: string;
  result?: Record<string, unknown>;
  errorMessage?: string;
  errorStack?: string;
  durationMs?: number;
}

export class UpdateTaskStatusCommand {
  constructor(
    public readonly taskId: string,
    public readonly newStatus: TaskStatus,
    public readonly payload: StatusUpdatePayload = {},
  ) {}
}

@CommandHandler(UpdateTaskStatusCommand)
export class UpdateTaskStatusHandler implements ICommandHandler<UpdateTaskStatusCommand> {
  private readonly logger = new Logger(UpdateTaskStatusHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TASK_PRODUCER) private readonly producer: TaskProducer,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateTaskStatusCommand) {
    const { taskId, newStatus, payload } = command;

    const existing = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    const previousStatus = existing.status as TaskStatus;

    if (!canTransition(previousStatus, newStatus)) {
      // A worker reporting a stale transition (e.g. task was cancelled by an
      // operator while the worker was mid-execution) is expected, not an
      // error condition worth failing loudly over — log and no-op.
      this.logger.warn(
        `Ignored illegal transition for task ${taskId}: ${previousStatus} -> ${newStatus}`,
      );
      return toTaskDto(existing);
    }

    const task = await this.applyTransition(existing.id, newStatus, existing, payload);

    const dto = toTaskDto(task);
    this.eventBus.publish(new TaskStatusChangedEvent(dto, previousStatus));

    if (newStatus === TaskStatus.RETRYING) {
      await this.scheduleRetry(task);
    }

    return dto;
  }

  private async applyTransition(
    taskId: string,
    newStatus: TaskStatus,
    existing: { retryCount: number; maxRetries: number },
    payload: StatusUpdatePayload,
  ) {
    const baseData: Prisma.TaskUpdateInput = { status: newStatus };

    switch (newStatus) {
      case TaskStatus.RUNNING:
        baseData.startedAt = new Date();
        // workerId is a relation scalar (foreign key) — connect or disconnect
        // the Worker relation rather than assigning the id directly, since
        // Prisma's generated TaskUpdateInput models `worker` as a relation
        // field, not a plain `workerId` scalar, when both sides are defined.
        if (payload.workerId) {
          baseData.worker = { connect: { id: payload.workerId } };
        }
        break;

      case TaskStatus.COMPLETED:
        baseData.completedAt = new Date();
        baseData.result = (payload.result ?? {}) as Prisma.InputJsonValue;
        baseData.durationMs = payload.durationMs ?? null;
        break;

      case TaskStatus.FAILED:
        baseData.completedAt = new Date();
        baseData.errorMessage = payload.errorMessage ?? 'Unknown error';
        baseData.errorStack = payload.errorStack ?? null;
        baseData.durationMs = payload.durationMs ?? null;
        break;

      case TaskStatus.RETRYING: {
        const nextRetryCount = existing.retryCount + 1;
        baseData.retryCount = nextRetryCount;
        baseData.errorMessage = payload.errorMessage ?? 'Unknown error';
        baseData.errorStack = payload.errorStack ?? null;
        baseData.nextRetryAt = new Date(Date.now() + computeBackoffDelayMs(nextRetryCount));
        break;
      }

      case TaskStatus.DEAD_LETTERED:
        baseData.completedAt = new Date();
        baseData.errorMessage = payload.errorMessage ?? 'Max retries exceeded';
        break;
    }

    return this.prisma.task.update({ where: { id: taskId }, data: baseData });
  }

  private async scheduleRetry(task: { id: string; type: string; payload: unknown; priority: string; maxRetries: number; retryCount: number }) {
    if (task.retryCount > task.maxRetries) {
      // Exhausted all attempts — move to DEAD_LETTERED rather than retrying forever.
      const deadLettered = await this.prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.DEAD_LETTERED,
          completedAt: new Date(),
          errorMessage: `Exceeded max retries (${task.maxRetries})`,
        },
      });
      this.eventBus.publish(new TaskStatusChangedEvent(toTaskDto(deadLettered), TaskStatus.RETRYING));
      this.logger.warn(`Task ${task.id} dead-lettered after exhausting ${task.maxRetries} retries`);
      return;
    }

    const message: TaskJobMessage = {
      taskId: task.id,
      type: task.type,
      payload: task.payload as Record<string, unknown>,
      priority: task.priority as TaskPriority,
      attempt: task.retryCount + 1,
      maxRetries: task.maxRetries,
      enqueuedAt: new Date().toISOString(),
    };

    await this.producer.scheduleRetry(message, task.retryCount);
    this.logger.log(`Task ${task.id} scheduled for retry attempt ${task.retryCount}`);
  }
}
