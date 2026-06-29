import * as amqp from 'amqplib';
import { EXCHANGES, QUEUES, ROUTING_KEYS, RETRY_QUEUE_PREFIX, DEAD_LETTER_QUEUE } from '@distrotask/shared';
import { TaskPriority } from '@distrotask/shared';

export interface RabbitMQConnectionOptions {
  url: string;
  /** Logger injected by the consuming app (NestJS Logger or console) */
  logger?: { log: (msg: string) => void; error: (msg: string, trace?: string) => void; warn: (msg: string) => void };
  reconnectDelayMs?: number;
}

/**
 * Owns the AMQP connection + channel lifecycle and asserts the full topology
 * (exchanges, priority queues, retry queues with TTL+DLX, dead letter queue)
 * idempotently on every (re)connect. Both the producer and consumer wrap this
 * class rather than talking to amqplib directly, so reconnect behavior is
 * defined exactly once.
 */
export class RabbitMQConnectionManager {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly logger: NonNullable<RabbitMQConnectionOptions['logger']>;
  private readonly url: string;
  private readonly reconnectDelayMs: number;
  private isShuttingDown = false;

  constructor(options: RabbitMQConnectionOptions) {
    this.url = options.url;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 5000;
    this.logger = options.logger ?? {
      log: (m) => console.log(`[RabbitMQ] ${m}`),
      error: (m, t) => console.error(`[RabbitMQ] ${m}`, t ?? ''),
      warn: (m) => console.warn(`[RabbitMQ] ${m}`),
    };
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();

      this.connection.on('close', () => {
        if (!this.isShuttingDown) {
          this.logger.warn('Connection closed unexpectedly, reconnecting...');
          this.scheduleReconnect();
        }
      });
      this.connection.on('error', (err: Error) => {
        this.logger.error(`Connection error: ${err.message}`, err.stack);
      });

      await this.assertTopology();
      this.logger.log('Connected and topology asserted');
    } catch (err) {
      this.logger.error(`Failed to connect: ${(err as Error).message}`);
      this.scheduleReconnect();
      throw err;
    }
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown) return;
    setTimeout(() => {
      this.connect().catch(() => {
        /* error already logged in connect() */
      });
    }, this.reconnectDelayMs);
  }

  /**
   * Declares the full exchange/queue topology described in queue.constants.ts.
   * Idempotent — safe to call on every reconnect since `assertExchange` /
   * `assertQueue` are no-ops if the topology already matches.
   */
  private async assertTopology(): Promise<void> {
    const ch = this.requireChannel();

    await ch.assertExchange(EXCHANGES.TASKS, 'direct', { durable: true });
    await ch.assertExchange(EXCHANGES.RETRY, 'direct', { durable: true });
    await ch.assertExchange(EXCHANGES.DLX, 'fanout', { durable: true });

    // Dead letter queue — final resting place after max retries exhausted
    await ch.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
    await ch.bindQueue(DEAD_LETTER_QUEUE, EXCHANGES.DLX, '');

    // One durable queue per priority, bound to the main TASKS exchange.
    // Each queue dead-letters to the DLX fanout when a message is nack'd
    // without requeue (i.e. after the consumer gives up).
    for (const priority of Object.values(TaskPriority)) {
      const queueName = QUEUES[priority];
      const routingKey = ROUTING_KEYS[priority];

      await ch.assertQueue(queueName, {
        durable: true,
        deadLetterExchange: EXCHANGES.DLX,
      });
      await ch.bindQueue(queueName, EXCHANGES.TASKS, routingKey);
    }

    // Retry queues: 6 attempt-tiers (covers a sane max-retries ceiling),
    // each with a fixed TTL. When a message's TTL expires, RabbitMQ
    // dead-letters it back onto the main TASKS exchange with its original
    // routing key — this is the standard "TTL + DLX" delayed-retry pattern,
    // since RabbitMQ has no native scheduled delivery without a plugin.
    const retryTiersMs = [2000, 4000, 8000, 16000, 32000, 64000];
    for (let i = 0; i < retryTiersMs.length; i++) {
      const attempt = i + 1;
      const queueName = `${RETRY_QUEUE_PREFIX}${attempt}`;
      await ch.assertQueue(queueName, {
        durable: true,
        messageTtl: retryTiersMs[i],
        deadLetterExchange: EXCHANGES.TASKS,
        // no explicit dead-letter-routing-key: amqplib will reuse the
        // message's original routing key on TTL expiry by default
      });
      await ch.bindQueue(queueName, EXCHANGES.RETRY, `retry.attempt.${attempt}`);
    }
  }

  getChannel(): amqp.Channel {
    return this.requireChannel();
  }

  private requireChannel(): amqp.Channel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized — call connect() first');
    }
    return this.channel;
  }

  async close(): Promise<void> {
    this.isShuttingDown = true;
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }
}
