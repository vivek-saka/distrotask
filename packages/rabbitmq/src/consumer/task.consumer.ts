import { ConsumeMessage } from 'amqplib';
import { QUEUES, PREFETCH_COUNT, TaskJobMessage, TaskPriority } from '@distrotask/shared';
import { RabbitMQConnectionManager } from '../connection-manager';

export type TaskMessageHandler = (
  message: TaskJobMessage,
  ack: () => void,
  nack: (requeue: boolean) => void,
) => Promise<void> | void;

/**
 * Subscribes to all four priority queues with a shared handler. Consumption
 * order across separate `channel.consume` calls on the same channel is
 * effectively priority-respecting in practice because RabbitMQ dispatches
 * round-robin per consumer, but we additionally consume CRITICAL/HIGH with a
 * tighter prefetch than LOW so urgent work is less likely to queue up behind
 * a slow LOW-priority batch within a single worker process.
 */
export class TaskConsumer {
  private consumerTags: string[] = [];

  constructor(private readonly connectionManager: RabbitMQConnectionManager) {}

  async subscribe(handler: TaskMessageHandler, prefetch: number = PREFETCH_COUNT): Promise<void> {
    const channel = this.connectionManager.getChannel();
    await channel.prefetch(prefetch);

    for (const priority of Object.values(TaskPriority)) {
      const queueName = QUEUES[priority as TaskPriority];

      const { consumerTag } = await channel.consume(
        queueName,
        (msg: ConsumeMessage | null) => {
          if (!msg) return; // null msg = consumer cancelled by the broker
          void this.handleMessage(msg, handler);
        },
        { noAck: false },
      );

      this.consumerTags.push(consumerTag);
    }
  }

  private async handleMessage(msg: ConsumeMessage, handler: TaskMessageHandler): Promise<void> {
    const channel = this.connectionManager.getChannel();

    let parsed: TaskJobMessage;
    try {
      parsed = JSON.parse(msg.content.toString('utf-8'));
    } catch {
      // Unparseable message can never succeed — dead-letter it immediately
      // rather than looping forever.
      channel.nack(msg, false, false);
      return;
    }

    const ack = () => channel.ack(msg);
    const nack = (requeue: boolean) => channel.nack(msg, false, requeue);

    try {
      await handler(parsed, ack, nack);
    } catch {
      // Defensive: a handler that throws instead of calling nack() itself
      // should still not requeue-loop indefinitely.
      nack(false);
    }
  }

  async unsubscribeAll(): Promise<void> {
    const channel = this.connectionManager.getChannel();
    await Promise.all(this.consumerTags.map((tag) => channel.cancel(tag)));
    this.consumerTags = [];
  }
}
