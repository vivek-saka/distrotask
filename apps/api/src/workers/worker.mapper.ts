import { Worker } from '@prisma/client';
import { WorkerDto } from '@distrotask/shared';

export function toWorkerDto(worker: Worker): WorkerDto {
  return {
    id: worker.id,
    name: worker.name,
    hostname: worker.hostname,
    pid: worker.pid,
    status: worker.status as WorkerDto['status'],
    queues: worker.queues,
    concurrency: worker.concurrency,
    currentTaskCount: worker.currentTaskCount,
    version: worker.version,
    lastHeartbeatAt: worker.lastHeartbeatAt?.toISOString() ?? null,
    startedAt: worker.startedAt.toISOString(),
    stoppedAt: worker.stoppedAt?.toISOString() ?? null,
  };
}
