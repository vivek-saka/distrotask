import { RabbitMQConnectionManager, TaskConsumer } from '@distrotask/rabbitmq';
import { TaskJobMessage } from '@distrotask/shared';
import { TaskRunner } from '../executors/task-runner';
import { workerConfig } from '../config/worker.config';
import { logger } from '../logger';

/**
 * Bridges the broker-agnostic TaskConsumer to this worker's concurrency
 * limit. RabbitMQ's own `channel.prefetch(n)` already caps how many
 * unacknowledged messages the broker will deliver at once, so this acts as
 * a second line of defense / explicit in-flight counter that the heartbeat
 * service reads to report `currentTaskCount`.
 */
export class WorkerConsumerLoop {
  private inFlight = 0;

  constructor(
    private readonly connectionManager: RabbitMQConnectionManager,
    private readonly taskRunner: TaskRunner,
  ) {}

  getCurrentTaskCount(): number {
    return this.inFlight;
  }

  async start(): Promise<void> {
    const consumer = new TaskConsumer(this.connectionManager);

    await consumer.subscribe(async (message: TaskJobMessage, ack, nack) => {
      // Filter by configured queues/types unless this worker accepts everything.
      if (!workerConfig.queues.includes('*') && !workerConfig.queues.includes(message.type)) {
        // Not our task type — requeue so another worker (with the right
        // executor registered) can pick it up, rather than dropping it.
        nack(true);
        return;
      }

      this.inFlight += 1;
      try {
        await this.taskRunner.run(message);
        // COMPLETED and permanently FAILED tasks are fully handled (status
        // already reported); RETRYING tasks have already been scheduled
        // onto a retry-tier queue by the API's UpdateTaskStatusCommand.
        // Either way, this message's job is done — ack it so it's removed
        // from the current queue (a RETRYING task's *next* attempt arrives
        // as a brand new message once its retry-tier TTL expires).
        ack();
      } catch (err) {
        // TaskRunner is defensive and shouldn't normally throw, but if the
        // API itself is unreachable for status reporting, nack-without-requeue
        // sends the message to the DLQ rather than looping forever against a
        // down dependency.
        logger.error(`Unhandled error processing task ${message.taskId}: ${(err as Error).message}`);
        nack(false);
      } finally {
        this.inFlight -= 1;
      }
    }, workerConfig.concurrency);

    logger.info(
      `Worker consumer loop started (concurrency=${workerConfig.concurrency}, queues=[${workerConfig.queues.join(', ')}])`,
    );
  }
}
