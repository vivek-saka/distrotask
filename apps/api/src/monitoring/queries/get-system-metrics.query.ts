import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TaskStatus as PrismaTaskStatus, WorkerStatus as PrismaWorkerStatus } from '@prisma/client';
import { SystemMetricsSnapshot, computeRate } from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';

export class GetSystemMetricsQuery {}

@QueryHandler(GetSystemMetricsQuery)
export class GetSystemMetricsHandler implements IQueryHandler<GetSystemMetricsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<SystemMetricsSnapshot> {
    const [statusCounts, totalTasks, avgDuration, recentCompletions, activeWorkerCount, totalWorkerCount] =
      await Promise.all([
        this.prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.task.count(),
        this.prisma.task.aggregate({
          _avg: { durationMs: true },
          where: { status: PrismaTaskStatus.COMPLETED, durationMs: { not: null } },
        }),
        // throughput: completed-or-failed in the last 60s, used to derive a per-minute rate
        this.prisma.task.count({
          where: {
            completedAt: { gte: new Date(Date.now() - 60_000) },
          },
        }),
        this.prisma.worker.count({
          where: {
            status: {
              in: [PrismaWorkerStatus.ONLINE, PrismaWorkerStatus.IDLE, PrismaWorkerStatus.BUSY],
            },
          },
        }),
        this.prisma.worker.count(),
      ]);

    const countByStatus = (status: PrismaTaskStatus) =>
      statusCounts.find((s) => s.status === status)?._count._all ?? 0;

    const completed = countByStatus(PrismaTaskStatus.COMPLETED);
    const failed = countByStatus(PrismaTaskStatus.FAILED);
    const deadLettered = countByStatus(PrismaTaskStatus.DEAD_LETTERED);
    const finishedTotal = completed + failed + deadLettered;

    return {
      totalTasks,
      pendingCount: countByStatus(PrismaTaskStatus.PENDING),
      queuedCount: countByStatus(PrismaTaskStatus.QUEUED),
      runningCount: countByStatus(PrismaTaskStatus.RUNNING),
      completedCount: completed,
      failedCount: failed,
      retryingCount: countByStatus(PrismaTaskStatus.RETRYING),
      cancelledCount: countByStatus(PrismaTaskStatus.CANCELLED),
      deadLetteredCount: deadLettered,
      successRate: computeRate(completed, finishedTotal),
      failureRate: computeRate(failed + deadLettered, finishedTotal),
      avgProcessingTimeMs: Math.round(avgDuration._avg.durationMs ?? 0),
      throughputPerMinute: recentCompletions,
      activeWorkerCount,
      totalWorkerCount,
      timestamp: new Date().toISOString(),
    };
  }
}
