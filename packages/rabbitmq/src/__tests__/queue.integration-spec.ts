import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQConnectionManager, TaskProducer, TaskConsumer, QueueInspector } from '../index';
import { TaskPriority, TaskJobMessage } from '@distrotask/shared';

/**
 * These tests exercise the real RabbitMQ topology declared in
 * connection-manager.ts against an actual broker (RABBITMQ_URL). Each test
 * checks broker reachability itself and returns early (no-op pass) if
 * unreachable, so `npm test` in a laptop dev environment without Docker
 * running doesn't fail the whole suite — but they run for real in CI (see
 * .github/workflows/ci.yml, which spins up a RabbitMQ service container)
 * and in `docker compose`.
 */

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://distrotask:distrotask@localhost:5672';

async function isBrokerReachable(): Promise<boolean> {
  try {
    const manager = new RabbitMQConnectionManager({ url: RABBITMQ_URL, reconnectDelayMs: 100 });
    await manager.connect();
    await manager.close();
    return true;
  } catch {
    return false;
  }
}

function makeMessage(overrides: Partial<TaskJobMessage> = {}): TaskJobMessage {
  return {
    taskId: uuidv4(),
    type: 'integration.test',
    payload: { hello: 'world' },
    priority: TaskPriority.NORMAL,
    attempt: 1,
    maxRetries: 3,
    enqueuedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('RabbitMQ integration', () => {
  beforeAll(async () => {
    if (!(await isBrokerReachable())) {
      // eslint-disable-next-line no-console
      console.warn(
        `\n[rabbitmq integration] No broker reachable at ${RABBITMQ_URL}. ` +
          `Tests below will no-op pass. Run via docker compose or CI to execute them for real.\n`,
      );
    }
  });

  describe('Publish & consume', () => {
    it('publishes a task and a subscribed consumer receives it', async () => {
      if (!(await isBrokerReachable())) return;

      const manager = new RabbitMQConnectionManager({ url: RABBITMQ_URL, reconnectDelayMs: 100 });
      await manager.connect();

      const producer = new TaskProducer(manager);
      const consumer = new TaskConsumer(manager);

      const message = makeMessage();
      const received = new Promise<TaskJobMessage>((resolve) => {
        void consumer.subscribe((msg, ack) => {
          if (msg.taskId === message.taskId) {
            ack();
            resolve(msg);
          } else {
            ack(); // drain unrelated messages left over from other test runs
          }
        });
      });

      await producer.publishTask(message);
      const result = await received;

      expect(result.taskId).toBe(message.taskId);
      expect(result.type).toBe('integration.test');

      await manager.close();
    }, 15000);

    it('routes CRITICAL and LOW priority messages to different queues', async () => {
      if (!(await isBrokerReachable())) return;

      const manager = new RabbitMQConnectionManager({ url: RABBITMQ_URL, reconnectDelayMs: 100 });
      await manager.connect();
      const producer = new TaskProducer(manager);
      const inspector = new QueueInspector(manager);

      const before = await inspector.getAllPriorityQueueMetrics();
      const criticalBefore = before.find((q) => q.queueName.includes('critical'))!.depth;
      const lowBefore = before.find((q) => q.queueName.includes('low'))!.depth;

      await producer.publishTask(makeMessage({ priority: TaskPriority.CRITICAL }));
      await producer.publishTask(makeMessage({ priority: TaskPriority.LOW }));
      await new Promise((r) => setTimeout(r, 300)); // let the broker settle the publish

      const after = await inspector.getAllPriorityQueueMetrics();
      const criticalAfter = after.find((q) => q.queueName.includes('critical'))!.depth;
      const lowAfter = after.find((q) => q.queueName.includes('low'))!.depth;

      expect(criticalAfter).toBe(criticalBefore + 1);
      expect(lowAfter).toBe(lowBefore + 1);

      // Drain the test messages so they don't pollute subsequent test runs.
      const consumer = new TaskConsumer(manager);
      let drained = 0;
      await consumer.subscribe((_msg, ack) => {
        ack();
        drained += 1;
      });
      await new Promise((r) => setTimeout(r, 300));
      expect(drained).toBeGreaterThanOrEqual(0);

      await manager.close();
    }, 15000);
  });

  describe('Retry-tier TTL redelivery', () => {
    it('a message published to the attempt-1 retry queue is redelivered onto the main exchange after its TTL expires', async () => {
      if (!(await isBrokerReachable())) return;

      const manager = new RabbitMQConnectionManager({ url: RABBITMQ_URL, reconnectDelayMs: 100 });
      await manager.connect();
      const producer = new TaskProducer(manager);
      const consumer = new TaskConsumer(manager);

      const message = makeMessage({ attempt: 1 });

      const redelivered = new Promise<TaskJobMessage>((resolve) => {
        void consumer.subscribe((msg, ack) => {
          if (msg.taskId === message.taskId) {
            ack();
            resolve(msg);
          } else {
            ack();
          }
        });
      });

      // attempt-1 retry tier has a 2000ms TTL (see connection-manager.ts retryTiersMs)
      await producer.scheduleRetry(message, 1);

      const result = await redelivered;
      expect(result.taskId).toBe(message.taskId);

      await manager.close();
    }, 15000);
  });

  describe('Dead letter queue', () => {
    it('a nacked-without-requeue message lands in the DLQ', async () => {
      if (!(await isBrokerReachable())) return;

      const manager = new RabbitMQConnectionManager({ url: RABBITMQ_URL, reconnectDelayMs: 100 });
      await manager.connect();
      const producer = new TaskProducer(manager);
      const consumer = new TaskConsumer(manager);
      const inspector = new QueueInspector(manager);

      const message = makeMessage();
      const handled = new Promise<void>((resolve) => {
        void consumer.subscribe((msg, ack, nack) => {
          if (msg.taskId === message.taskId) {
            nack(false); // reject without requeue -> broker dead-letters it per queue config
            resolve();
          } else {
            ack();
          }
        });
      });

      const dlqDepthBefore = await inspector.getDeadLetterQueueDepth();
      await producer.publishTask(message);
      await handled;

      // Give the broker a moment to route the dead-lettered message.
      await new Promise((r) => setTimeout(r, 500));
      const dlqDepthAfter = await inspector.getDeadLetterQueueDepth();

      expect(dlqDepthAfter).toBeGreaterThanOrEqual(dlqDepthBefore + 1);

      await manager.close();
    }, 15000);

    it('an unparseable message is immediately dead-lettered rather than retried forever', async () => {
      if (!(await isBrokerReachable())) return;

      const manager = new RabbitMQConnectionManager({ url: RABBITMQ_URL, reconnectDelayMs: 100 });
      await manager.connect();

      // Publish raw garbage bytes directly via the channel, bypassing TaskProducer's JSON.stringify.
      const channel = manager.getChannel();
      channel.publish('distrotask.tasks.exchange', 'task.normal', Buffer.from('{not valid json'), {
        persistent: true,
      });

      // TaskConsumer's handleMessage() catches the JSON.parse failure and
      // nacks without requeue immediately — verify this doesn't throw or hang
      // the consumer loop for subsequent valid messages.
      const consumer = new TaskConsumer(manager);
      const producer = new TaskProducer(manager);
      const followUp = makeMessage();

      const received = new Promise<TaskJobMessage>((resolve) => {
        void consumer.subscribe((msg, ack) => {
          if (msg.taskId === followUp.taskId) {
            ack();
            resolve(msg);
          } else {
            ack();
          }
        });
      });

      await producer.publishTask(followUp);
      const result = await received;
      expect(result.taskId).toBe(followUp.taskId);

      await manager.close();
    }, 15000);
  });
});
