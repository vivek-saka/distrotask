import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { WsTaskUpdatedPayload, WsTaskStatusChangedPayload } from '@distrotask/shared';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskStatusChangedEvent,
  TaskDeletedEvent,
} from '../../tasks/events/task.events';
import { EventsGateway } from '../events.gateway';

@EventsHandler(TaskCreatedEvent)
export class TaskCreatedWsHandler implements IEventHandler<TaskCreatedEvent> {
  constructor(private readonly gateway: EventsGateway) {}

  handle(event: TaskCreatedEvent) {
    const payload: WsTaskUpdatedPayload = { task: event.task };
    this.gateway.emitTaskCreated(payload);
  }
}

@EventsHandler(TaskUpdatedEvent)
export class TaskUpdatedWsHandler implements IEventHandler<TaskUpdatedEvent> {
  constructor(private readonly gateway: EventsGateway) {}

  handle(event: TaskUpdatedEvent) {
    const payload: WsTaskUpdatedPayload = { task: event.task };
    this.gateway.emitTaskUpdated(payload);
  }
}

@EventsHandler(TaskStatusChangedEvent)
export class TaskStatusChangedWsHandler implements IEventHandler<TaskStatusChangedEvent> {
  constructor(private readonly gateway: EventsGateway) {}

  handle(event: TaskStatusChangedEvent) {
    const payload: WsTaskStatusChangedPayload = {
      taskId: event.task.id,
      previousStatus: event.previousStatus,
      newStatus: event.task.status,
      task: event.task,
    };
    this.gateway.emitTaskStatusChanged(payload);
  }
}

@EventsHandler(TaskDeletedEvent)
export class TaskDeletedWsHandler implements IEventHandler<TaskDeletedEvent> {
  constructor(private readonly gateway: EventsGateway) {}

  handle(event: TaskDeletedEvent) {
    this.gateway.emitTaskDeleted({ taskId: event.taskId });
  }
}
