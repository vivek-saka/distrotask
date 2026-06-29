import { TaskJobMessage, TaskStatus, TaskLogLevel } from '@distrotask/shared';
import { executorRegistry } from './executor-registry';
import { ApiClient } from '../api-client/api-client';
import { logger } from '../logger';
import { tasksProcessedCounter, taskDurationHistogram } from '../metrics';

export interface TaskRunResult {
  outcome: 'completed' | 'failed' | 'retrying';
}

/**
 * Executes a single task job end-to-end: reports RUNNING, dispatches to the
 * registered executor for the task's `type`, and reports the terminal
 * outcome (COMPLETED / FAILED / RETRYING) back to the API. Retry-vs-fail
 * classification: an unregistered executor or attempt >= maxRetries goes
 * straight to FAILED; everything else that throws goes to RETRYING so the
 * broker's TTL+DLX mechanism redelivers it with backoff.
 */
export class TaskRunner {
  constructor(
    private readonly apiClient: ApiClient,
    private readonly workerId: string,
  ) {}

  async run(message: TaskJobMessage): Promise<TaskRunResult> {
    const startedAt = Date.now();

    await this.apiClient.updateTaskStatus(message.taskId, TaskStatus.RUNNING, {
      workerId: this.workerId,
    });

    const executor = executorRegistry.resolve(message.type);

    if (!executor) {
      const errorMessage = `No executor registered for task type "${message.type}"`;
      logger.error(errorMessage, { taskId: message.taskId });
      await this.apiClient.updateTaskStatus(message.taskId, TaskStatus.FAILED, {
        errorMessage,
        durationMs: Date.now() - startedAt,
      });
      tasksProcessedCounter.inc({ outcome: 'failed', type: message.type });
      taskDurationHistogram.observe({ type: message.type, outcome: 'failed' }, (Date.now() - startedAt) / 1000);
      return { outcome: 'failed' };
    }

    try {
      const result = await executor(message.payload, {
        taskId: message.taskId,
        attempt: message.attempt,
        log: (msg, metadata) => this.apiClient.appendLog(message.taskId, TaskLogLevel.INFO, msg, metadata),
      });

      const durationMs = Date.now() - startedAt;
      await this.apiClient.updateTaskStatus(message.taskId, TaskStatus.COMPLETED, {
        result: result ?? {},
        durationMs,
      });

      tasksProcessedCounter.inc({ outcome: 'completed', type: message.type });
      taskDurationHistogram.observe({ type: message.type, outcome: 'completed' }, durationMs / 1000);

      logger.info(`Task ${message.taskId} completed in ${durationMs}ms`, { type: message.type });
      return { outcome: 'completed' };
    } catch (err) {
      const error = err as Error;
      const durationMs = Date.now() - startedAt;

      await this.apiClient.appendLog(message.taskId, TaskLogLevel.ERROR, error.message);

      if (message.attempt >= message.maxRetries) {
        logger.warn(
          `Task ${message.taskId} failed permanently after ${message.attempt} attempts: ${error.message}`,
        );
        await this.apiClient.updateTaskStatus(message.taskId, TaskStatus.FAILED, {
          errorMessage: error.message,
          errorStack: error.stack,
          durationMs,
        });
        tasksProcessedCounter.inc({ outcome: 'failed', type: message.type });
        taskDurationHistogram.observe({ type: message.type, outcome: 'failed' }, durationMs / 1000);
        return { outcome: 'failed' };
      }

      logger.warn(
        `Task ${message.taskId} failed (attempt ${message.attempt}/${message.maxRetries}), will retry: ${error.message}`,
      );
      await this.apiClient.updateTaskStatus(message.taskId, TaskStatus.RETRYING, {
        errorMessage: error.message,
        errorStack: error.stack,
      });
      tasksProcessedCounter.inc({ outcome: 'retrying', type: message.type });
      taskDurationHistogram.observe({ type: message.type, outcome: 'retrying' }, durationMs / 1000);
      return { outcome: 'retrying' };
    }
  }
}
