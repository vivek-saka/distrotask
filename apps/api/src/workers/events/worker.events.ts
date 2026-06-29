import { WorkerDto } from '@distrotask/shared';

export class WorkerRegisteredEvent {
  constructor(public readonly worker: WorkerDto) {}
}

export class WorkerHeartbeatEvent {
  constructor(public readonly worker: WorkerDto) {}
}

export class WorkerStatusChangedEvent {
  constructor(
    public readonly worker: WorkerDto,
    public readonly previousStatus: string,
  ) {}
}

export class WorkerOfflineEvent {
  constructor(public readonly worker: WorkerDto) {}
}
