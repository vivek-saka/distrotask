import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { toTaskDto } from '../task.mapper';

export class GetTaskByIdQuery {
  constructor(public readonly taskId: string) {}
}

@QueryHandler(GetTaskByIdQuery)
export class GetTaskByIdHandler implements IQueryHandler<GetTaskByIdQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetTaskByIdQuery) {
    const task = await this.prisma.task.findUnique({ where: { id: query.taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return toTaskDto(task);
  }
}
