export const REDIS_KEYS = {
  /** Cache for a single task lookup, keyed by id */
  TASK: (id: string) => `task:${id}`,
  /** Cached, denormalized system metrics snapshot for fast dashboard reads */
  SYSTEM_METRICS: 'metrics:system',
  /** Per-queue depth cache, refreshed by the monitoring poller */
  QUEUE_DEPTH: (queueName: string) => `queue:depth:${queueName}`,
  /** Worker presence set (used for fast "active worker count" reads) */
  ACTIVE_WORKERS: 'workers:active',
  /** Rate limiting bucket per user */
  RATE_LIMIT: (userId: string) => `ratelimit:${userId}`,
  /** Refresh token denylist (for logout / rotation) */
  REFRESH_DENYLIST: (jti: string) => `refresh:denylist:${jti}`,
} as const;

export const CACHE_TTL = {
  TASK_SECONDS: 30,
  SYSTEM_METRICS_SECONDS: 5,
  QUEUE_DEPTH_SECONDS: 5,
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const JWT_DEFAULTS = {
  ACCESS_TOKEN_EXPIRES_IN: '15m',
  REFRESH_TOKEN_EXPIRES_IN: '7d',
} as const;
