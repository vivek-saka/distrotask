import { TaskDto, WorkerDto, SystemMetricsSnapshot, QueueMetricsSnapshot } from './domain';

/**
 * Canonical WebSocket event names. Both the NestJS gateway (apps/api) and the
 * Next.js client (apps/web) import this enum so event names can never drift
 * out of sync between emitter and listener.
 */
export enum WsEvent {
  // Task lifecycle
  TASK_CREATED = 'task.created',
  TASK_UPDATED = 'task.updated',
  TASK_STATUS_CHANGED = 'task.status_changed',
  TASK_DELETED = 'task.deleted',

  // Worker lifecycle
  WORKER_REGISTERED = 'worker.registered',
  WORKER_HEARTBEAT = 'worker.heartbeat',
  WORKER_STATUS_CHANGED = 'worker.status_changed',
  WORKER_OFFLINE = 'worker.offline',

  // Aggregate metrics, pushed on an interval
  METRICS_SYSTEM = 'metrics.system',
  METRICS_QUEUE = 'metrics.queue',

  // Connection lifecycle
  CONNECTED = 'connection.established',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
}

export interface WsTaskUpdatedPayload {
  task: TaskDto;
}

export interface WsTaskStatusChangedPayload {
  taskId: string;
  previousStatus: string;
  newStatus: string;
  task: TaskDto;
}

export interface WsWorkerUpdatedPayload {
  worker: WorkerDto;
}

export interface WsMetricsSystemPayload extends SystemMetricsSnapshot {}

export interface WsMetricsQueuePayload {
  queues: QueueMetricsSnapshot[];
}

/** Rooms a client can subscribe to, to scope which events it receives. */
export enum WsRoom {
  TASKS = 'room:tasks',
  WORKERS = 'room:workers',
  METRICS = 'room:metrics',
}
