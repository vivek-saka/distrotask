import { RabbitMQConnectionManager } from '@distrotask/rabbitmq';
import { workerConfig } from './config/worker.config';
import { logger } from './logger';
import { ApiClient } from './api-client/api-client';
import { HeartbeatService } from './heartbeat/heartbeat.service';
import { TaskRunner } from './executors/task-runner';
import { WorkerConsumerLoop } from './consumers/worker-consumer-loop';
import { createMetricsServer } from './metrics-server';
import './executors/built-in.executors'; // side-effect import: registers all built-in executors

async function bootstrap() {
  logger.info(`Starting DistroTask worker "${workerConfig.workerName}"...`);
  logger.info(`Accepting task types: ${workerConfig.queues.join(', ')}`);

  const apiClient = new ApiClient();

  // 1. Register with the API. If this fails, there is no point starting
  //    consumption — the worker would process tasks but never report back.
  const workerId = await retryWithBackoff(() => apiClient.registerWorker(), 'worker registration');
  logger.info(`Registered with API, worker id = ${workerId}`);

  // 2. Connect to RabbitMQ (the connection manager handles its own
  //    reconnect-on-drop internally after this initial connect succeeds).
  const connectionManager = new RabbitMQConnectionManager({
    url: workerConfig.rabbitmqUrl,
    logger: {
      log: (m) => logger.info(m),
      error: (m, t) => logger.error(m, { stack: t }),
      warn: (m) => logger.warn(m),
    },
  });
  await retryWithBackoff(() => connectionManager.connect(), 'RabbitMQ connection');

  // 3. Wire up the consumer loop and start pulling jobs.
  const taskRunner = new TaskRunner(apiClient, workerId);
  const consumerLoop = new WorkerConsumerLoop(connectionManager, taskRunner);
  await consumerLoop.start();

  // 4. Start sending heartbeats so the API/dashboard see this worker as alive.
  const heartbeatService = new HeartbeatService(apiClient, workerId, () => consumerLoop.getCurrentTaskCount());
  heartbeatService.start();

  // 5. Expose /health and /metrics for Docker healthchecks and Prometheus.
  createMetricsServer(() => consumerLoop.getCurrentTaskCount());

  logger.info('Worker is up and consuming tasks.');

  // ── Graceful shutdown ────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    heartbeatService.stop();
    await connectionManager.close();
    logger.info('Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

/** Simple retry-with-backoff for startup-critical operations (registration, broker connect). */
async function retryWithBackoff<T>(fn: () => Promise<T>, label: string, maxAttempts = 10): Promise<T> {
  let attempt = 0;
  let lastError: Error | undefined;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      attempt += 1;
      const delayMs = Math.min(2000 * 2 ** attempt, 30_000);
      logger.warn(
        `${label} failed (attempt ${attempt}/${maxAttempts}): ${lastError.message}. Retrying in ${delayMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`${label} failed after ${maxAttempts} attempts: ${lastError?.message}`);
}

bootstrap().catch((err) => {
  logger.error(`Fatal error during worker startup: ${(err as Error).message}`, { stack: (err as Error).stack });
  process.exit(1);
});
