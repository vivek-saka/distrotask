import { QUEUES, DEAD_LETTER_QUEUE } from '@distrotask/shared';
import { TaskPriority, QueueMetricsSnapshot } from '@distrotask/shared';
import { RabbitMQConnectionManager } from '../connection-manager';

/**
 * Reads live queue depth using `channel.checkQueue`, which returns
 * `messageCount` and `consumerCount` without requiring the RabbitMQ
 * management HTTP API/plugin — keeps the monitoring module dependency-free
 * of anything beyond the AMQP connection it already has.
 */
export class QueueInspector {
  constructor(private readonly connectionManager: RabbitMQConnectionManager) {}

  async getQueueDepth(queueName: string): Promise<{ messageCount: number; consumerCount: number }> {
    const channel = this.connectionManager.getChannel();
    const result = await channel.checkQueue(queueName);
    return { messageCount: result.messageCount, consumerCount: result.consumerCount };
  }

  async getAllPriorityQueueMetrics(): Promise<QueueMetricsSnapshot[]> {
    const snapshots: QueueMetricsSnapshot[] = [];

    for (const priority of Object.values(TaskPriority)) {
      const queueName = QUEUES[priority as TaskPriority];
      const { messageCount, consumerCount } = await this.getQueueDepth(queueName);
      snapshots.push({
        queueName,
        depth: messageCount,
        consumerCount,
        messageRatePerSecond: 0, // computed by the monitoring module from historical samples
      });
    }

    return snapshots;
  }

  async getDeadLetterQueueDepth(): Promise<number> {
    const { messageCount } = await this.getQueueDepth(DEAD_LETTER_QUEUE);
    return messageCount;
  }
}
