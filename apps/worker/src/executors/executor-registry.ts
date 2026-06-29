export interface ExecutorContext {
  taskId: string;
  attempt: number;
  /** Append a log line visible in the dashboard's live task log stream. */
  log: (message: string, metadata?: Record<string, unknown>) => Promise<void>;
}

export type TaskExecutor = (
  payload: Record<string, unknown>,
  ctx: ExecutorContext,
) => Promise<Record<string, unknown> | void>;

/**
 * Central registry mapping a task's `type` string (e.g. "email.send",
 * "report.generate") to the function that actually executes it. New task
 * types are added by registering a new executor here — the consumer loop,
 * retry logic, and status reporting are entirely type-agnostic.
 */
class ExecutorRegistry {
  private readonly executors = new Map<string, TaskExecutor>();

  register(type: string, executor: TaskExecutor): void {
    if (this.executors.has(type)) {
      throw new Error(`An executor is already registered for task type "${type}"`);
    }
    this.executors.set(type, executor);
  }

  resolve(type: string): TaskExecutor | undefined {
    return this.executors.get(type);
  }

  registeredTypes(): string[] {
    return Array.from(this.executors.keys());
  }
}

export const executorRegistry = new ExecutorRegistry();
