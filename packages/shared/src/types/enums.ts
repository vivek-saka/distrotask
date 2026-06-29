// Mirrors prisma/schema.prisma enums.
// Kept as plain TS enums (not re-exported from @prisma/client) so that the
// Next.js web app and the worker process never need a Prisma Client dependency
// just to know what a task status string can be.

export enum UserRole {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  VIEWER = 'VIEWER',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  CANCELLED = 'CANCELLED',
  DEAD_LETTERED = 'DEAD_LETTERED',
}

export enum TaskPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
  LOW = 'LOW',
}

export enum WorkerStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  IDLE = 'IDLE',
  BUSY = 'BUSY',
  DRAINING = 'DRAINING',
}

export enum TaskLogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export enum ScheduleType {
  ONE_TIME = 'ONE_TIME',
  CRON = 'CRON',
  INTERVAL = 'INTERVAL',
}

/**
 * Legal state transitions for a Task. Enforced centrally so the API
 * (command handlers) and the worker (status updates) never let a task
 * jump into an invalid state.
 */
export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.PENDING]: [TaskStatus.QUEUED, TaskStatus.CANCELLED],
  [TaskStatus.QUEUED]: [TaskStatus.RUNNING, TaskStatus.CANCELLED],
  [TaskStatus.RUNNING]: [
    TaskStatus.COMPLETED,
    TaskStatus.FAILED,
    TaskStatus.RETRYING,
    TaskStatus.CANCELLED,
  ],
  [TaskStatus.RETRYING]: [TaskStatus.QUEUED, TaskStatus.CANCELLED],
  [TaskStatus.FAILED]: [TaskStatus.QUEUED], // manual retry re-queues
  [TaskStatus.COMPLETED]: [],
  [TaskStatus.CANCELLED]: [],
  [TaskStatus.DEAD_LETTERED]: [TaskStatus.QUEUED], // manual replay from DLQ
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
