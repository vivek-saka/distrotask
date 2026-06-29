import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { WorkerStatus, WORKER_HEARTBEAT_TIMEOUT_MS } from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';
import { toWorkerDto } from '../worker.mapper';
import { WorkerOfflineEvent } from '../events/worker.events';

export class DetectStaleWorkersCommand {}

@CommandHandler(DetectStaleWorkersCommand)
export class DetectStaleWorkersHandler implements ICommandHandler<DetectStaleWorkersCommand> {
  private readonly logger = new Logger(DetectStaleWorkersHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(): Promise<{ markedOffline: number }> {
    const cutoff = new Date(Date.now() - WORKER_HEARTBEAT_TIMEOUT_MS);

    const staleWorkers = await this.prisma.worker.findMany({
      where: {
        status: { not: WorkerStatus.OFFLINE },
        OR: [{ lastHeartbeatAt: { lt: cutoff } }, { lastHeartbeatAt: null }],
      },
    });

    if (staleWorkers.length === 0) {
      return { markedOffline: 0 };
    }

    await this.prisma.worker.updateMany({
      where: { id: { in: staleWorkers.map((w) => w.id) } },
      data: { status: WorkerStatus.OFFLINE, stoppedAt: new Date() },
    });

    for (const worker of staleWorkers) {
      this.logger.warn(`Worker ${worker.name} marked OFFLINE (missed heartbeat timeout)`);
      this.eventBus.publish(
        new WorkerOfflineEvent(toWorkerDto({ ...worker, status: WorkerStatus.OFFLINE, stoppedAt: new Date() })),
      );
    }

    return { markedOffline: staleWorkers.length };
  }
}
