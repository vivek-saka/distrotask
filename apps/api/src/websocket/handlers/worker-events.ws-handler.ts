import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { WsWorkerUpdatedPayload } from '@distrotask/shared';
import {
  WorkerRegisteredEvent,
  WorkerHeartbeatEvent,
  WorkerStatusChangedEvent,
  WorkerOfflineEvent,
} from '../../workers/events/worker.events';
import { EventsGateway } from '../events.gateway';

@EventsHandler(WorkerRegisteredEvent)
export class WorkerRegisteredWsHandler implements IEventHandler<WorkerRegisteredEvent> {
  constructor(private readonly gateway: EventsGateway) {}

  handle(event: WorkerRegisteredEvent) {
    const payload: WsWorkerUpdatedPayload = { worker: event.worker };
    this.gateway.emitWorkerRegistered(payload);
  }
}

@EventsHandler(WorkerHeartbeatEvent)
export class WorkerHeartbeatWsHandler implements IEventHandler<WorkerHeartbeatEvent> {
  constructor(private readonly gateway: EventsGateway) {}

  handle(event: WorkerHeartbeatEvent) {
    const payload: WsWorkerUpdatedPayload = { worker: event.worker };
    this.gateway.emitWorkerHeartbeat(payload);
  }
}

@EventsHandler(WorkerStatusChangedEvent)
export class WorkerStatusChangedWsHandler implements IEventHandler<WorkerStatusChangedEvent> {
  constructor(private readonly gateway: EventsGateway) {}

  handle(event: WorkerStatusChangedEvent) {
    const payload: WsWorkerUpdatedPayload = { worker: event.worker };
    this.gateway.emitWorkerStatusChanged(payload);
  }
}

@EventsHandler(WorkerOfflineEvent)
export class WorkerOfflineWsHandler implements IEventHandler<WorkerOfflineEvent> {
  constructor(private readonly gateway: EventsGateway) {}

  handle(event: WorkerOfflineEvent) {
    const payload: WsWorkerUpdatedPayload = { worker: event.worker };
    this.gateway.emitWorkerOffline(payload);
  }
}
