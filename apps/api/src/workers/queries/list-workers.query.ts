import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { WorkerStatus as PrismaWorkerStatus } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { toWorkerDto } from '../worker.mapper';

export class ListWorkersQuery {
  constructor(public readonly status?: string) {}
}

@QueryHandler(ListWorkersQuery)
export class ListWorkersHandler implements IQueryHandler<ListWorkersQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListWorkersQuery) {
    const workers = await this.prisma.worker.findMany({
      where: query.status ? { status: query.status as PrismaWorkerStatus } : undefined,
      orderBy: { startedAt: 'desc' },
    });
    return workers.map(toWorkerDto);
  }
}

export class GetWorkerByIdQuery {
  constructor(public readonly workerId: string) {}
}

@QueryHandler(GetWorkerByIdQuery)
export class GetWorkerByIdHandler implements IQueryHandler<GetWorkerByIdQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetWorkerByIdQuery) {
    const worker = await this.prisma.worker.findUnique({ where: { id: query.workerId } });
    if (!worker) {
      throw new NotFoundException('Worker not found');
    }
    return toWorkerDto(worker);
  }
}
