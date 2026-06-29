# DistroTask — API Reference

Base URL: `http://localhost:3001/api/v1` (local) — interactive Swagger UI is always available at `/api/docs`.

All successful responses are wrapped in a consistent envelope:

```json
{
  "success": true,
  "data": { },
  "timestamp": "2026-06-21T10:00:00.000Z"
}
```

All errors follow:

```json
{
  "statusCode": 400,
  "timestamp": "2026-06-21T10:00:00.000Z",
  "path": "/api/v1/tasks",
  "method": "POST",
  "message": "Validation failed",
  "error": "Bad Request"
}
```

Authenticated routes require `Authorization: Bearer <accessToken>`. Internal worker-callback routes require `x-worker-token: <WORKER_SERVICE_TOKEN>` instead.

---

## Authentication

### `POST /auth/register`

Register a new account. The **first** user ever registered becomes `ADMIN`; everyone after defaults to `VIEWER`.

**Request**
```json
{
  "email": "ada@example.com",
  "password": "StrongPass1",
  "firstName": "Ada",
  "lastName": "Lovelace"
}
```

**Response `201`**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresIn": "15m",
    "user": {
      "id": "b3f1...",
      "email": "ada@example.com",
      "firstName": "Ada",
      "lastName": "Lovelace",
      "role": "ADMIN"
    }
  }
}
```

### `POST /auth/login`

**Request**: `{ "email": "...", "password": "..." }` — **Response `200`**: same shape as register.

### `POST /auth/refresh`

Rotates the refresh token. **Request**: `{ "refreshToken": "..." }` — **Response `200`**: a brand-new token pair. The old refresh token is immediately invalidated; reusing it returns `401`.

### `POST /auth/logout` (auth required)

Revokes the current refresh token. No body. **Response `200`**: `{ "success": true }`.

### `GET /auth/me` (auth required)

Returns the authenticated user's profile.

---

## Tasks

### `POST /tasks` (auth required)

Create and enqueue a task.

**Request**
```json
{
  "name": "Send welcome email",
  "type": "email.send",
  "payload": { "to": "user@example.com", "subject": "Welcome!" },
  "priority": "HIGH",
  "queueName": "default",
  "maxRetries": 3,
  "idempotencyKey": "optional-dedupe-key"
}
```
Only `name`, `type`, and `payload` are required; everything else defaults (`priority: NORMAL`, `maxRetries: 3`).

**Response `201`**
```json
{
  "success": true,
  "data": {
    "id": "c4a2...",
    "name": "Send welcome email",
    "type": "email.send",
    "payload": { "to": "user@example.com" },
    "result": null,
    "status": "QUEUED",
    "priority": "HIGH",
    "queueName": "default",
    "maxRetries": 3,
    "retryCount": 0,
    "errorMessage": null,
    "createdById": "b3f1...",
    "workerId": null,
    "queuedAt": "2026-06-21T10:00:00.100Z",
    "createdAt": "2026-06-21T10:00:00.050Z",
    "updatedAt": "2026-06-21T10:00:00.100Z"
  }
}
```

### `GET /tasks` (auth required)

List tasks, paginated and filterable.

**Query params**: `status`, `priority`, `queueName`, `type`, `search`, `page` (default 1), `pageSize` (default 20, max 100).

**Response `200`**
```json
{
  "success": true,
  "data": {
    "data": [],
    "meta": { "total": 137, "page": 1, "pageSize": 20, "totalPages": 7 }
  }
}
```

### `GET /tasks/:id` (auth required) — single task.
### `GET /tasks/:id/logs` (auth required) — ordered array of `TaskLogDto`.

### `PATCH /tasks/:id` (auth required)

Update a task — **only while it is `PENDING` or `QUEUED`**. Body: any subset of `{ name, payload, priority, maxRetries }`. Returns `400` for tasks in any other status.

### `POST /tasks/:id/cancel` (auth required)

Cancel a task. Legal from `PENDING`, `QUEUED`, `RUNNING`, or `RETRYING`. A `RUNNING` task is cancelled cooperatively (the row flips to `CANCELLED` immediately; the in-flight worker observes this on its next status checkpoint rather than being force-killed).

### `POST /tasks/:id/retry` (auth required)

Manually re-queue a `FAILED` or `DEAD_LETTERED` task. Resets `retryCount` to `0` and clears the error fields — a fresh attempt, distinct from automatic backoff retries.

### `DELETE /tasks/:id` (auth required)

Hard-delete — only permitted once a task reaches a terminal state (`COMPLETED`, `FAILED`, `CANCELLED`, `DEAD_LETTERED`).

### Internal worker callbacks (require `x-worker-token`, not a user JWT)

- **`PATCH /tasks/:id/status`** — `{ "status": "COMPLETED|FAILED|RUNNING|RETRYING|DEAD_LETTERED", "workerId"?, "result"?, "errorMessage"?, "errorStack"?, "durationMs"? }`
- **`POST /tasks/:id/logs`** — `{ "level": "DEBUG|INFO|WARN|ERROR", "message": "...", "metadata"? }`

---

## Workers

### `GET /workers` (auth required) — list, optional `?status=` filter.
### `GET /workers/active-count` (auth required) — `{ "active": 3, "total": 5 }`.
### `GET /workers/:id` (auth required) — single worker.
### `GET /workers/:id/metrics` (auth required) — recent `WorkerMetricDto[]` snapshots, optional `?limit=`.

### Internal worker callbacks

**`POST /workers/register`** (worker token required)
```json
{
  "name": "worker-email-01",
  "hostname": "ip-10-0-1-23",
  "pid": 4821,
  "queues": ["email.send", "report.generate"],
  "concurrency": 5,
  "version": "1.0.0"
}
```
Upserts by `name` — a restarting worker re-registers under the same identity rather than creating a duplicate row.

**`POST /workers/:id/heartbeat`** (worker token required)
```json
{ "currentTaskCount": 2, "cpuUsagePercent": 14.2, "memoryUsageMb": 312.5 }
```
Flips the worker's status to `BUSY` (count > 0) or `IDLE` (count = 0) and records a `WorkerMetric` snapshot.

---

## Monitoring

### `GET /monitoring/system` (auth required)

```json
{
  "success": true,
  "data": {
    "totalTasks": 482,
    "pendingCount": 3, "queuedCount": 12, "runningCount": 5,
    "completedCount": 440, "failedCount": 15, "retryingCount": 2,
    "cancelledCount": 4, "deadLetteredCount": 1,
    "successRate": 96.7, "failureRate": 3.3,
    "avgProcessingTimeMs": 842, "throughputPerMinute": 18,
    "activeWorkerCount": 3, "totalWorkerCount": 4,
    "timestamp": "2026-06-21T10:00:00.000Z"
  }
}
```

### `GET /monitoring/queues` (auth required)

```json
{
  "success": true,
  "data": {
    "queues": [
      { "queueName": "distrotask.queue.critical", "depth": 0, "consumerCount": 2, "messageRatePerSecond": 0 },
      { "queueName": "distrotask.queue.high", "depth": 4, "consumerCount": 2, "messageRatePerSecond": 0 }
    ],
    "deadLetterDepth": 1
  }
}
```

### `GET /monitoring/prometheus` (public)

Returns raw Prometheus text-exposition format (not JSON) — scraped by the Prometheus container on a 10s interval. See `infrastructure/prometheus/prometheus.yml`.

### `GET /health` (public)

```json
{ "success": true, "data": { "status": "ok", "uptime": 3821.4, "dependencies": { "database": "up" } } }
```

---

## Status codes used throughout

| Code | Meaning |
|---|---|
| `200` | Successful GET/PATCH/DELETE/logout |
| `201` | Successful POST (resource created or action performed) |
| `400` | Validation failure or illegal state transition |
| `401` | Missing/invalid JWT or worker token |
| `403` | Authenticated but insufficient role (`@Roles()` guard) |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate email on register) |
| `429` | Rate limited (`@Throttle()` on auth endpoints) |
| `500` | Unexpected server error |

Full live schema (request/response DTOs, all error shapes) is always authoritative at **`/api/docs`** (Swagger UI), generated directly from the NestJS decorators — this document is a human-readable companion, not a replacement.
