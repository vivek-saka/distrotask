import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WorkerStatus as PrismaWorkerStatus } from '@prisma/client';
import { WorkerMetricDto } from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';

export class GetWorkerMetricsQuery {
  constructor(
    public readonly workerId: string,
    public readonly limit: number = 50,
  ) {}
}

@QueryHandler(GetWorkerMetricsQuery)
export class GetWorkerMetricsHandler implements IQueryHandler<GetWorkerMetricsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetWorkerMetricsQuery): Promise<WorkerMetricDto[]> {
    const metrics = await this.prisma.workerMetric.findMany({
      where: { workerId: query.workerId },
      orderBy: { recordedAt: 'desc' },
      take: query.limit,
    });

    return metrics.map((m) => ({
      id: m.id,
      workerId: m.workerId,
      cpuUsagePercent: m.cpuUsagePercent,
      memoryUsageMb: m.memoryUsageMb,
      tasksProcessed: m.tasksProcessed,
      tasksFailed: m.tasksFailed,
      avgDurationMs: m.avgDurationMs,
      queueDepthSnapshot: m.queueDepthSnapshot,
      recordedAt: m.recordedAt.toISOString(),
    }));
  }
}

export class GetActiveWorkerCountQuery {}

@QueryHandler(GetActiveWorkerCountQuery)
export class GetActiveWorkerCountHandler implements IQueryHandler<GetActiveWorkerCountQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<{ active: number; total: number }> {
    const [active, total] = await Promise.all([
      this.prisma.worker.count({
        where: { status: { in: [PrismaWorkerStatus.ONLINE, PrismaWorkerStatus.IDLE, PrismaWorkerStatus.BUSY] } },
      }),
      this.prisma.worker.count(),
    ]);
    return { active, total };
  }
}
