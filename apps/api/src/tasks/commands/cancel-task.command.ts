import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskStatus, canTransition } from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';
import { toTaskDto } from '../task.mapper';
import { TaskStatusChangedEvent } from '../events/task.events';

export class CancelTaskCommand {
  constructor(public readonly taskId: string) {}
}

@CommandHandler(CancelTaskCommand)
export class CancelTaskHandler implements ICommandHandler<CancelTaskCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CancelTaskCommand) {
    const existing = await this.prisma.task.findUnique({ where: { id: command.taskId } });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    const previousStatus = existing.status as TaskStatus;

    if (!canTransition(previousStatus, TaskStatus.CANCELLED)) {
      throw new BadRequestException(
        `Task in status ${previousStatus} cannot be cancelled. ` +
          `Only PENDING, QUEUED, RUNNING, or RETRYING tasks may be cancelled.`,
      );
    }

    // For RUNNING tasks: we flip the DB row to CANCELLED immediately so the
    // dashboard reflects intent right away. The worker executing this task
    // polls task.status (or checks it on its next progress checkpoint, per
    // executor implementation) and aborts cooperatively when it observes
    // CANCELLED — this is a cooperative-cancellation model, not a hard kill,
    // since forcibly terminating arbitrary in-flight work isn't generally
    // safe (partial side effects, unflushed I/O, etc).
    const task = await this.prisma.task.update({
      where: { id: command.taskId },
      data: { status: TaskStatus.CANCELLED, completedAt: new Date() },
    });

    const dto = toTaskDto(task);
    this.eventBus.publish(new TaskStatusChangedEvent(dto, previousStatus));
    return dto;
  }
}
