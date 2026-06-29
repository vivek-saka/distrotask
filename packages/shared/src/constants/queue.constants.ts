import { TaskPriority } from '../types/enums';

/**
 * RabbitMQ topology.
 *
 * Design:
 *  - One topic exchange ("distrotask.tasks") that all task jobs are published to.
 *  - Per-priority queues bound to the exchange, so a CRITICAL task is never stuck
 *    behind a backlog of LOW priority tasks (RabbitMQ does not support true
 *    per-message priority ordering reliably at scale, so we use separate queues
 *    instead of the x-max-priority queue argument, which only works well within
 *    a single queue's prefetch window).
 *  - A retry exchange + per-priority retry queues with message TTL implement
 *    delayed retry (the TTL-expiry + dead-letter-exchange trick, since RabbitMQ
 *    has no native delayed delivery without a plugin).
 *  - A dead-letter exchange + queue is the final resting place for tasks that
 *    exhaust all retry attempts.
 */

export const EXCHANGES = {
  TASKS: 'distrotask.tasks.exchange',
  RETRY: 'distrotask.retry.exchange',
  DLX: 'distrotask.dlx.exchange',
} as const;

export const ROUTING_KEYS: Record<TaskPriority, string> = {
  [TaskPriority.CRITICAL]: 'task.critical',
  [TaskPriority.HIGH]: 'task.high',
  [TaskPriority.NORMAL]: 'task.normal',
  [TaskPriority.LOW]: 'task.low',
};

export const QUEUES: Record<TaskPriority, string> = {
  [TaskPriority.CRITICAL]: 'distrotask.queue.critical',
  [TaskPriority.HIGH]: 'distrotask.queue.high',
  [TaskPriority.NORMAL]: 'distrotask.queue.normal',
  [TaskPriority.LOW]: 'distrotask.queue.low',
};

/**
 * Retry queues use per-attempt TTL queues so that after the message expires
 * it is dead-lettered back onto the main TASKS exchange with the original
 * routing key, effectively "delaying" redelivery by `ttlMs`.
 */
export const RETRY_QUEUE_PREFIX = 'distrotask.retry.attempt.';

export const DEAD_LETTER_QUEUE = 'distrotask.dlq';

/** Base delay and multiplier for exponential backoff retry scheduling. */
export const BACKOFF = {
  BASE_DELAY_MS: 2000,
  MULTIPLIER: 2,
  MAX_DELAY_MS: 5 * 60 * 1000, // cap at 5 minutes
  JITTER_MS: 500,
} as const;

/**
 * Computes the delay (ms) before retry attempt N (1-indexed) using
 * full exponential backoff with jitter: base * multiplier^(attempt-1), capped.
 */
export function computeBackoffDelayMs(attempt: number): number {
  const raw = BACKOFF.BASE_DELAY_MS * Math.pow(BACKOFF.MULTIPLIER, attempt - 1);
  const capped = Math.min(raw, BACKOFF.MAX_DELAY_MS);
  const jitter = Math.floor(Math.random() * BACKOFF.JITTER_MS);
  return capped + jitter;
}

export const PREFETCH_COUNT = 10;

export const WORKER_HEARTBEAT_INTERVAL_MS = 10_000;
/** A worker missing 3 consecutive heartbeats is considered OFFLINE. */
export const WORKER_HEARTBEAT_TIMEOUT_MS = WORKER_HEARTBEAT_INTERVAL_MS * 3;
