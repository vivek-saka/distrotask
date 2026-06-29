import { Buffer } from 'buffer';
import { EXCHANGES, ROUTING_KEYS, RETRY_QUEUE_PREFIX, TaskJobMessage, TaskPriority } from '@distrotask/shared';
import { RabbitMQConnectionManager } from '../connection-manager';

export class TaskProducer {
  constructor(private readonly connectionManager: RabbitMQConnectionManager) {}

  /** Publishes a brand-new task job onto its priority queue. */
  async publishTask(message: TaskJobMessage): Promise<void> {
    const channel = this.connectionManager.getChannel();
    const routingKey = ROUTING_KEYS[message.priority];

    const published = channel.publish(
      EXCHANGES.TASKS,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: message.taskId,
        timestamp: Date.now(),
        headers: { attempt: message.attempt, priority: message.priority },
      },
    );

    if (!published) {
      // channel.publish returns false when the internal write buffer is full
      // (backpressure) — caller should treat this as a transient failure.
      throw new Error(`Failed to publish task ${message.taskId}: channel write buffer full`);
    }
  }

  /**
   * Routes a failed task into the appropriate retry-tier queue so it is
   * redelivered onto the main exchange after that tier's TTL expires.
   * `attempt` must be 1-indexed and capped to the number of provisioned
   * retry tiers (6, see connection-manager.ts).
   */
  async scheduleRetry(message: TaskJobMessage, attempt: number): Promise<void> {
    const channel = this.connectionManager.getChannel();
    const tier = Math.min(attempt, 6);
    const routingKey = `retry.attempt.${tier}`;

    const published = channel.publish(
      EXCHANGES.RETRY,
      routingKey,
      Buffer.from(JSON.stringify({ ...message, attempt })),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: message.taskId,
        timestamp: Date.now(),
        headers: { attempt, priority: message.priority, retryTier: tier },
      },
    );

    if (!published) {
      throw new Error(`Failed to schedule retry for task ${message.taskId}: channel write buffer full`);
    }
  }

  /**
   * Skips straight to a specific priority queue — used when an operator
   * manually re-queues a FAILED or DEAD_LETTERED task from the dashboard.
   */
  async republish(message: TaskJobMessage): Promise<void> {
    await this.publishTask({ ...message, attempt: 1, enqueuedAt: new Date().toISOString() });
  }
}

export { RETRY_QUEUE_PREFIX };
export type { TaskJobMessage, TaskPriority };
