import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TaskProducer } from '@distrotask/rabbitmq';
import { TaskPriority, TaskStatus, TaskJobMessage } from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';
import { TASK_PRODUCER } from '../../queue/queue.module';
import { toTaskDto } from '../task.mapper';
import { TaskCreatedEvent, TaskStatusChangedEvent } from '../events/task.events';

export class CreateTaskCommand {
  constructor(
    public readonly createdById: string,
    public readonly name: string,
    public readonly type: string,
    public readonly payload: Record<string, unknown>,
    public readonly priority?: TaskPriority,
    public readonly queueName?: string,
    public readonly maxRetries?: number,
    public readonly idempotencyKey?: string,
  ) {}
}

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand> {
  private readonly logger = new Logger(CreateTaskHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TASK_PRODUCER) private readonly producer: TaskProducer,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateTaskCommand) {
    if (command.idempotencyKey) {
      const existing = await this.prisma.task.findUnique({
        where: { idempotencyKey: command.idempotencyKey },
      });
      if (existing) {
        this.logger.warn(`Idempotent create skipped for key ${command.idempotencyKey}`);
        return toTaskDto(existing);
      }
    }

    // Step 1: persist as PENDING. This is the durable source of truth —
    // even if the broker publish below fails, the task row exists and can
    // be recovered/republished by a reconciliation job (see docs/architecture.md
    // for the "outbox-lite" note on this dual-write tradeoff).
    const task = await this.prisma.task.create({
      data: {
        name: command.name,
        type: command.type,
        payload: command.payload as Prisma.InputJsonValue,
        priority: command.priority ?? TaskPriority.NORMAL,
        queueName: command.queueName ?? 'default',
        maxRetries: command.maxRetries ?? 3,
        createdById: command.createdById,
        idempotencyKey: command.idempotencyKey,
        status: TaskStatus.PENDING,
      },
    });

    this.eventBus.publish(new TaskCreatedEvent(toTaskDto(task)));

    // Step 2: publish to the broker and flip to QUEUED.
    const message: TaskJobMessage = {
      taskId: task.id,
      type: task.type,
      payload: task.payload as Record<string, unknown>,
      priority: task.priority as TaskPriority,
      attempt: 1,
      maxRetries: task.maxRetries,
      enqueuedAt: new Date().toISOString(),
    };

    try {
      await this.producer.publishTask(message);
    } catch (err) {
      this.logger.error(`Failed to publish task ${task.id} to broker: ${(err as Error).message}`);
      // Task remains PENDING in Postgres; a retry/reconciliation sweep can
      // re-publish it later. We deliberately do not throw here so the API
      // call still succeeds and returns the created (PENDING) task — the
      // caller sees an accurate status rather than a confusing 500 for a
      // row that was, in fact, persisted.
      return toTaskDto(task);
    }

    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.QUEUED, queuedAt: new Date() },
    });

    this.eventBus.publish(new TaskStatusChangedEvent(toTaskDto(updated), TaskStatus.PENDING));

    return toTaskDto(updated);
  }
}
