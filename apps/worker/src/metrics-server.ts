import express, { Express } from 'express';
import { workerMetricsRegistry, currentTaskCountGauge } from './metrics';
import { workerConfig } from './config/worker.config';
import { logger } from './logger';

export function createMetricsServer(getCurrentTaskCount: () => number): Express {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', worker: workerConfig.workerName, uptime: process.uptime() });
  });

  app.get('/metrics', async (_req, res) => {
    currentTaskCountGauge.set(getCurrentTaskCount());
    res.set('Content-Type', workerMetricsRegistry.contentType);
    res.send(await workerMetricsRegistry.metrics());
  });

  app.listen(workerConfig.metricsPort, () => {
    logger.info(`Worker metrics server listening on port ${workerConfig.metricsPort}`);
  });

  return app;
}
