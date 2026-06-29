import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { BadRequestException, Inject, Logger, NotFoundException } from '@nestjs/common';
import { TaskProducer } from '@distrotask/rabbitmq';
import { TaskStatus, TaskPriority, TaskJobMessage, canTransition } from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';
import { TASK_PRODUCER } from '../../queue/queue.module';
import { toTaskDto } from '../task.mapper';
import { TaskStatusChangedEvent } from '../events/task.events';

export class RetryTaskCommand {
  constructor(public readonly taskId: string) {}
}

@CommandHandler(RetryTaskCommand)
export class RetryTaskHandler implements ICommandHandler<RetryTaskCommand> {
  private readonly logger = new Logger(RetryTaskHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TASK_PRODUCER) private readonly producer: TaskProducer,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RetryTaskCommand) {
    const existing = await this.prisma.task.findUnique({ where: { id: command.taskId } });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    const previousStatus = existing.status as TaskStatus;

    if (!canTransition(previousStatus, TaskStatus.QUEUED)) {
      throw new BadRequestException(
        `Task in status ${previousStatus} cannot be retried. Only FAILED or DEAD_LETTERED tasks may be manually retried.`,
      );
    }

    // Manual retry resets the attempt counter — this is a deliberate,
    // operator-initiated fresh attempt, distinct from the automatic
    // exponential-backoff retries the worker schedules on transient failure.
    const task = await this.prisma.task.update({
      where: { id: command.taskId },
      data: {
        status: TaskStatus.QUEUED,
        retryCount: 0,
        nextRetryAt: null,
        errorMessage: null,
        errorStack: null,
        queuedAt: new Date(),
      },
    });

    const message: TaskJobMessage = {
      taskId: task.id,
      type: task.type,
      payload: task.payload as Record<string, unknown>,
      priority: task.priority as TaskPriority,
      attempt: 1,
      maxRetries: task.maxRetries,
      enqueuedAt: new Date().toISOString(),
    };

    await this.producer.republish(message);
    this.logger.log(`Task ${task.id} manually re-queued (was ${previousStatus})`);

    const dto = toTaskDto(task);
    this.eventBus.publish(new TaskStatusChangedEvent(dto, previousStatus));
    return dto;
  }
}
