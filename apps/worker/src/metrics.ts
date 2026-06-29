import { Counter, Gauge, Histogram, Registry } from 'prom-client';

export const workerMetricsRegistry = new Registry();

export const tasksProcessedCounter = new Counter({
  name: 'distrotask_worker_tasks_processed_total',
  help: 'Total tasks processed by this worker, by outcome',
  labelNames: ['outcome', 'type'],
  registers: [workerMetricsRegistry],
});

export const taskDurationHistogram = new Histogram({
  name: 'distrotask_worker_task_duration_seconds',
  help: 'Task execution duration in seconds',
  labelNames: ['type', 'outcome'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [workerMetricsRegistry],
});

export const currentTaskCountGauge = new Gauge({
  name: 'distrotask_worker_current_task_count',
  help: 'Number of tasks currently being processed by this worker',
  registers: [workerMetricsRegistry],
});
