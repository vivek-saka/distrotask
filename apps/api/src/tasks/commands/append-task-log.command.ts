import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Prisma } from '@prisma/client';
import { TaskLogLevel, TaskLogDto } from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';

export class AppendTaskLogCommand {
  constructor(
    public readonly taskId: string,
    public readonly level: TaskLogLevel,
    public readonly message: string,
    public readonly metadata?: Record<string, unknown>,
  ) {}
}

@CommandHandler(AppendTaskLogCommand)
export class AppendTaskLogHandler implements ICommandHandler<AppendTaskLogCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: AppendTaskLogCommand): Promise<TaskLogDto> {
    const log = await this.prisma.taskLog.create({
      data: {
        taskId: command.taskId,
        level: command.level,
        message: command.message,
        metadata: (command.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    return {
      id: log.id,
      taskId: log.taskId,
      level: log.level as TaskLogDto['level'],
      message: log.message,
      metadata: log.metadata as Record<string, unknown> | null,
      createdAt: log.createdAt.toISOString(),
    };
  }
}
