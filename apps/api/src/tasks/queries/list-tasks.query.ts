import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Prisma, TaskStatus as PrismaTaskStatus, TaskPriority as PrismaTaskPriority } from '@prisma/client';
import { PaginatedResult, TaskDto, PAGINATION_DEFAULTS } from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';
import { toTaskDto } from '../task.mapper';

export class ListTasksQuery {
  constructor(
    public readonly status?: string,
    public readonly priority?: string,
    public readonly queueName?: string,
    public readonly type?: string,
    public readonly search?: string,
    public readonly page: number = PAGINATION_DEFAULTS.PAGE,
    public readonly pageSize: number = PAGINATION_DEFAULTS.PAGE_SIZE,
  ) {}
}

@QueryHandler(ListTasksQuery)
export class ListTasksHandler implements IQueryHandler<ListTasksQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListTasksQuery): Promise<PaginatedResult<TaskDto>> {
    const pageSize = Math.min(query.pageSize, PAGINATION_DEFAULTS.MAX_PAGE_SIZE);
    const page = Math.max(query.page, 1);

    const where: Prisma.TaskWhereInput = {
      ...(query.status && { status: query.status as PrismaTaskStatus }),
      ...(query.priority && { priority: query.priority as PrismaTaskPriority }),
      ...(query.queueName && { queueName: query.queueName }),
      ...(query.type && { type: query.type }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { type: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks.map(toTaskDto),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }
}
