import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

/**
 * Central Prometheus metric registry for the API service. The Worker
 * service runs its own separate registry (apps/worker) scraped on its own
 * port, since each process should expose only the metrics it actually owns.
 */
@Injectable()
export class PrometheusMetricsService {
  public readonly registry = new Registry();

  public readonly httpRequestDuration = new Histogram({
    name: 'distrotask_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  public readonly tasksCreatedTotal = new Counter({
    name: 'distrotask_tasks_created_total',
    help: 'Total number of tasks created',
    labelNames: ['priority', 'type'],
    registers: [this.registry],
  });

  public readonly tasksCompletedTotal = new Counter({
    name: 'distrotask_tasks_completed_total',
    help: 'Total number of tasks completed successfully',
    labelNames: ['type'],
    registers: [this.registry],
  });

  public readonly tasksFailedTotal = new Counter({
    name: 'distrotask_tasks_failed_total',
    help: 'Total number of tasks that failed (including dead-lettered)',
    labelNames: ['type'],
    registers: [this.registry],
  });

  public readonly activeWorkersGauge = new Gauge({
    name: 'distrotask_active_workers',
    help: 'Current number of active (non-offline) workers',
    registers: [this.registry],
  });

  public readonly queueDepthGauge = new Gauge({
    name: 'distrotask_queue_depth',
    help: 'Current number of messages waiting in each priority queue',
    labelNames: ['queue'],
    registers: [this.registry],
  });

  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }
}
