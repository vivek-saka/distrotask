import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { WorkerStatus } from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';
import { toWorkerDto } from '../worker.mapper';
import { WorkerHeartbeatEvent, WorkerStatusChangedEvent } from '../events/worker.events';

export class RecordHeartbeatCommand {
  constructor(
    public readonly workerId: string,
    public readonly currentTaskCount: number,
    public readonly cpuUsagePercent?: number,
    public readonly memoryUsageMb?: number,
  ) {}
}

@CommandHandler(RecordHeartbeatCommand)
export class RecordHeartbeatHandler implements ICommandHandler<RecordHeartbeatCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RecordHeartbeatCommand) {
    const existing = await this.prisma.worker.findUnique({ where: { id: command.workerId } });
    if (!existing) {
      throw new NotFoundException('Worker not found — it may need to re-register');
    }

    const previousStatus = existing.status as WorkerStatus;
    const newStatus = command.currentTaskCount > 0 ? WorkerStatus.BUSY : WorkerStatus.IDLE;

    const worker = await this.prisma.worker.update({
      where: { id: command.workerId },
      data: {
        lastHeartbeatAt: new Date(),
        currentTaskCount: command.currentTaskCount,
        status: newStatus,
      },
    });

    // Lightweight metric snapshot on every heartbeat — gives the Workers
    // page a CPU/memory sparkline without a separate polling mechanism.
    await this.prisma.workerMetric.create({
      data: {
        workerId: command.workerId,
        cpuUsagePercent: command.cpuUsagePercent,
        memoryUsageMb: command.memoryUsageMb,
        tasksProcessed: 0, // incremented by the worker's own counters via a separate metrics push, see MonitoringModule
        tasksFailed: 0,
        queueDepthSnapshot: null,
      },
    });

    const dto = toWorkerDto(worker);
    this.eventBus.publish(new WorkerHeartbeatEvent(dto));

    if (previousStatus !== newStatus) {
      this.eventBus.publish(new WorkerStatusChangedEvent(dto, previousStatus));
    }

    return dto;
  }
}
