import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TaskPriority, TaskStatus, omitUndefined } from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';
import { toTaskDto } from '../task.mapper';
import { TaskUpdatedEvent } from '../events/task.events';

export class UpdateTaskCommand {
  constructor(
    public readonly taskId: string,
    public readonly name?: string,
    public readonly payload?: Record<string, unknown>,
    public readonly priority?: TaskPriority,
    public readonly maxRetries?: number,
  ) {}
}

const MUTABLE_STATUSES: TaskStatus[] = [TaskStatus.PENDING, TaskStatus.QUEUED];

@CommandHandler(UpdateTaskCommand)
export class UpdateTaskHandler implements ICommandHandler<UpdateTaskCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateTaskCommand) {
    const existing = await this.prisma.task.findUnique({ where: { id: command.taskId } });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    if (!MUTABLE_STATUSES.includes(existing.status as TaskStatus)) {
      throw new BadRequestException(
        `Task cannot be edited while in status ${existing.status}. Only PENDING or QUEUED tasks may be updated.`,
      );
    }

    const data = omitUndefined({
      name: command.name,
      payload: command.payload as Prisma.InputJsonValue | undefined,
      priority: command.priority,
      maxRetries: command.maxRetries,
    });

    const task = await this.prisma.task.update({ where: { id: command.taskId }, data });

    const dto = toTaskDto(task);
    this.eventBus.publish(new TaskUpdatedEvent(dto));
    return dto;
  }
}
