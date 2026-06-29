import {
  TaskStatus,
  TaskPriority,
  WorkerStatus,
  UserRole,
  TaskLogLevel,
  ScheduleType,
} from './enums';

export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface TaskDto {
  id: string;
  name: string;
  type: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  status: TaskStatus;
  priority: TaskPriority;
  queueName: string;
  maxRetries: number;
  retryCount: number;
  backoffStrategy: string;
  nextRetryAt: string | null;
  errorMessage: string | null;
  createdById: string;
  workerId: string | null;
  scheduleId: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskLogDto {
  id: string;
  taskId: string;
  level: TaskLogLevel;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface WorkerDto {
  id: string;
  name: string;
  hostname: string;
  pid: number;
  status: WorkerStatus;
  queues: string[];
  concurrency: number;
  currentTaskCount: number;
  version: string | null;
  lastHeartbeatAt: string | null;
  startedAt: string;
  stoppedAt: string | null;
}

export interface WorkerMetricDto {
  id: string;
  workerId: string;
  cpuUsagePercent: number | null;
  memoryUsageMb: number | null;
  tasksProcessed: number;
  tasksFailed: number;
  avgDurationMs: number | null;
  queueDepthSnapshot: number | null;
  recordedAt: string;
}

export interface TaskScheduleDto {
  id: string;
  name: string;
  type: ScheduleType;
  expression: string;
  taskType: string;
  payload: Record<string, unknown>;
  priority: TaskPriority;
  queueName: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdById: string;
}

/** Message envelope published onto RabbitMQ for a task execution job. */
export interface TaskJobMessage {
  taskId: string;
  type: string;
  payload: Record<string, unknown>;
  priority: TaskPriority;
  attempt: number;
  maxRetries: number;
  enqueuedAt: string;
}

/** Result a worker publishes back after executing a task. */
export interface TaskResultMessage {
  taskId: string;
  workerId: string;
  success: boolean;
  result?: Record<string, unknown>;
  errorMessage?: string;
  errorStack?: string;
  durationMs: number;
  completedAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface QueueMetricsSnapshot {
  queueName: string;
  depth: number;
  consumerCount: number;
  messageRatePerSecond: number;
}

export interface SystemMetricsSnapshot {
  totalTasks: number;
  pendingCount: number;
  queuedCount: number;
  runningCount: number;
  completedCount: number;
  failedCount: number;
  retryingCount: number;
  cancelledCount: number;
  deadLetteredCount: number;
  successRate: number;
  failureRate: number;
  avgProcessingTimeMs: number;
  throughputPerMinute: number;
  activeWorkerCount: number;
  totalWorkerCount: number;
  timestamp: string;
}
