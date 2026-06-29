import { TaskDto } from '@distrotask/shared';

export class TaskCreatedEvent {
  constructor(public readonly task: TaskDto) {}
}

export class TaskUpdatedEvent {
  constructor(public readonly task: TaskDto) {}
}

export class TaskStatusChangedEvent {
  constructor(
    public readonly task: TaskDto,
    public readonly previousStatus: string,
  ) {}
}

export class TaskDeletedEvent {
  constructor(public readonly taskId: string) {}
}
