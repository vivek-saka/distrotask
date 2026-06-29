import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskStatus, isTerminalStatus } from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';
import { TaskDeletedEvent } from '../events/task.events';

export class DeleteTaskCommand {
  constructor(public readonly taskId: string) {}
}

@CommandHandler(DeleteTaskCommand)
export class DeleteTaskHandler implements ICommandHandler<DeleteTaskCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: DeleteTaskCommand) {
    const existing = await this.prisma.task.findUnique({ where: { id: command.taskId } });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    if (!isTerminalStatus(existing.status as TaskStatus)) {
      throw new BadRequestException(
        `Cannot delete a task in status ${existing.status}. Cancel it first, or wait for it to reach a terminal state.`,
      );
    }

    await this.prisma.task.delete({ where: { id: command.taskId } });

    this.eventBus.publish(new TaskDeletedEvent(command.taskId));
    return { success: true, taskId: command.taskId };
  }
}
