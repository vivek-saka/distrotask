import axios, { AxiosInstance } from 'axios';
import { TaskStatus, TaskLogLevel } from '@distrotask/shared';
import { workerConfig } from '../config/worker.config';
import { logger } from '../logger';

export class ApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: workerConfig.apiBaseUrl,
      timeout: 10_000,
      headers: { 'x-worker-token': workerConfig.workerServiceToken },
    });
  }

  async registerWorker(): Promise<string> {
    const response = await this.http.post('/api/v1/workers/register', {
      name: workerConfig.workerName,
      hostname: workerConfig.hostname,
      pid: workerConfig.pid,
      queues: workerConfig.queues,
      concurrency: workerConfig.concurrency,
      version: workerConfig.version,
    });
    // API wraps successful responses in { success, data, timestamp }
    const workerId = response.data?.data?.id;
    if (!workerId) {
      throw new Error('Worker registration response did not include an id');
    }
    return workerId;
  }

  async sendHeartbeat(
    workerId: string,
    currentTaskCount: number,
    cpuUsagePercent?: number,
    memoryUsageMb?: number,
  ): Promise<void> {
    await this.http.post(`/api/v1/workers/${workerId}/heartbeat`, {
      currentTaskCount,
      cpuUsagePercent,
      memoryUsageMb,
    });
  }

  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    payload: {
      workerId?: string;
      result?: Record<string, unknown>;
      errorMessage?: string;
      errorStack?: string;
      durationMs?: number;
    } = {},
  ): Promise<void> {
    try {
      await this.http.patch(`/api/v1/tasks/${taskId}/status`, { status, ...payload });
    } catch (err) {
      // Status-update failures shouldn't crash task execution — log loudly
      // so it's visible in worker logs/Grafana, but let the consumer loop
      // continue. A reconciliation job (or the DLQ) is the safety net for
      // tasks whose final state never made it back to Postgres.
      logger.error(`Failed to report status ${status} for task ${taskId}: ${(err as Error).message}`);
    }
  }

  async appendLog(
    taskId: string,
    level: TaskLogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.http.post(`/api/v1/tasks/${taskId}/logs`, { level, message, metadata });
    } catch (err) {
      logger.warn(`Failed to append log for task ${taskId}: ${(err as Error).message}`);
    }
  }
}
