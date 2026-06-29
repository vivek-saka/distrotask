import 'dotenv/config';
import * as os from 'os';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const workerConfig = {
  rabbitmqUrl: requireEnv('RABBITMQ_URL'),
  apiBaseUrl: requireEnv('API_BASE_URL'),
  workerServiceToken: requireEnv('WORKER_SERVICE_TOKEN'),

  /** Logical worker identity — stable across restarts so the API upserts rather than duplicates. */
  workerName: process.env.WORKER_NAME ?? `worker-${os.hostname()}-${process.pid}`,
  hostname: os.hostname(),
  pid: process.pid,

  /** Task `type` strings this worker instance will accept. "*" = all types. */
  queues: (process.env.WORKER_QUEUES ?? '*').split(',').map((q) => q.trim()),

  concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '5', 10),
  heartbeatIntervalMs: parseInt(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? '10000', 10),
  metricsPort: parseInt(process.env.WORKER_METRICS_PORT ?? '9100', 10),
  version: process.env.npm_package_version ?? '1.0.0',
};
