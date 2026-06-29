import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TaskLogDto } from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';

export class GetTaskLogsQuery {
  constructor(public readonly taskId: string) {}
}

@QueryHandler(GetTaskLogsQuery)
export class GetTaskLogsHandler implements IQueryHandler<GetTaskLogsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetTaskLogsQuery): Promise<TaskLogDto[]> {
    const logs = await this.prisma.taskLog.findMany({
      where: { taskId: query.taskId },
      orderBy: { createdAt: 'asc' },
    });

    return logs.map((log) => ({
      id: log.id,
      taskId: log.taskId,
      level: log.level as TaskLogDto['level'],
      message: log.message,
      metadata: log.metadata as Record<string, unknown> | null,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}
