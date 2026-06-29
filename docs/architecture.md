# DistroTask — Architecture

## 1. High-Level Architecture

```
                                   ┌─────────────────────┐
                                   │   Next.js Dashboard   │
                                   │  (Overview, Tasks,     │
                                   │   Workers, Monitoring, │
                                   │   Analytics)           │
                                   └──────────┬─────────────┘
                                              │ REST (HTTPS)         │ WebSocket
                                              │                      │
                          ┌───────────────────▼──────────────────────▼───────────┐
                          │                  NestJS API Service                   │
                          │  ┌────────┐ ┌────────┐ ┌─────────┐ ┌──────────────┐  │
                          │  │  Auth  │ │ Tasks  │ │ Workers │ │  Monitoring   │  │
                          │  │ (CQRS) │ │ (CQRS) │ │ (CQRS)  │ │  (CQRS)       │  │
                          │  └───┬────┘ └───┬────┘ └────┬────┘ └──────┬───────┘  │
                          │      │          │            │             │          │
                          │  ┌───▼──────────▼────────────▼─────────────▼───────┐ │
                          │  │      WebSocket Gateway (Socket.IO, CQRS Event   │ │
                          │  │      Bus → live broadcast to dashboard rooms)   │ │
                          │  └──────────────────────────────────────────────────┘ │
                          └───────┬───────────────────┬──────────────────┬────────┘
                                  │                    │                  │
                         ┌────────▼────────┐  ┌────────▼────────┐ ┌──────▼───────┐
                         │   PostgreSQL     │  │    RabbitMQ      │ │    Redis     │
                         │ (source of truth)│  │ (priority queues,│ │  (cache /    │
                         │                  │  │  retry, DLQ)     │ │   sessions)  │
                         └──────────────────┘  └────────┬─────────┘ └──────────────┘
                                                          │
                                          ┌───────────────▼────────────────┐
                                          │     Worker Service (×N)         │
                                          │  Consumer → Executor Registry   │
                                          │  → HTTP callback to API         │
                                          └──────────────────────────────────┘

                          ┌──────────────┐        ┌──────────────┐
                          │  Prometheus   │◄───────│   Grafana     │
                          │  (scrapes API │        │  (dashboards) │
                          │   + Worker)   │        └──────────────┘
                          └──────────────┘
```

DistroTask is a microservice-oriented distributed task queue: an **API service** owns all state mutation and read models, a horizontally-scalable **Worker service** does the actual task execution, **RabbitMQ** decouples the two, **PostgreSQL** is the single source of truth, and a **WebSocket gateway** pushes real-time state to the **Next.js dashboard**.

---

## 2. Component Responsibilities

### 2.1 API Service (`apps/api`)

The only service that talks to PostgreSQL directly. Owns every state transition for Users, Tasks, Workers, and Schedules. Internally organized as **NestJS feature modules**, each implementing full CQRS:

| Module | Responsibility |
|---|---|
| `AuthModule` | Registration, login, JWT issuance/rotation, refresh-token revocation |
| `UsersModule` | User listing and role administration (admin-only) |
| `TasksModule` | Task CRUD, lifecycle transitions (cancel/retry), log ingestion |
| `WorkersModule` | Worker registration, heartbeat ingestion, stale-worker detection |
| `QueueModule` | Owns the RabbitMQ connection; exposes `TaskProducer` / `QueueInspector` to other modules |
| `WebsocketModule` | Socket.IO gateway; subscribes to the CQRS event bus and re-broadcasts to rooms |
| `MonitoringModule` | Aggregate system/queue metrics, Prometheus `/metrics` endpoint, periodic WS broadcast |

The API is the **only** service workers are allowed to call into (via a shared-secret-authenticated internal API), and the **only** service the dashboard talks to.

### 2.2 Worker Service (`apps/worker`)

A standalone Node.js process (no NestJS framework — deliberately lightweight) that:

1. Registers itself with the API on startup (`POST /workers/register`)
2. Connects to RabbitMQ and subscribes to all four priority queues
3. For each message: resolves the task's `type` against a local **executor registry**, runs the executor, and reports the outcome back to the API via HTTP
4. Sends periodic heartbeats with CPU/memory/current-load metrics
5. Exposes its own `/metrics` (Prometheus) and `/health` endpoints

Designed to be run as multiple replicas (`docker compose up --scale worker=4`); each instance is stateless beyond its in-memory current-task counter.

### 2.3 RabbitMQ (`packages/rabbitmq`)

Shared package (not a service) consumed by both the API (producer side) and the Worker (consumer side), so the topology definition lives in exactly one place. See [Queue Architecture](#4-queue-architecture).

### 2.4 PostgreSQL

Single source of truth for all durable state. See [Database Architecture](#5-database-architecture).

### 2.5 Redis

Reserved for caching and session-adjacent data (rate-limit buckets, refresh-token denylist keys, hot read caches for dashboard queries). Not yet load-bearing for core task execution — Postgres + RabbitMQ are sufficient for correctness; Redis is a performance optimization layer.

### 2.6 Next.js Dashboard (`apps/web`)

Server-rendered React app (App Router) with:
- React Query for REST data fetching/caching
- Zustand for auth/session and live WebSocket state
- Socket.IO client for real-time task/worker/metrics updates
- Six pages: Overview, Tasks, Workers, Monitoring, Analytics, plus Login/Register

### 2.7 Observability stack

Prometheus scrapes both the API (`/api/v1/monitoring/prometheus`) and each Worker (`/metrics`) on a 10s interval. Grafana is pre-provisioned with a datasource pointing at Prometheus and a starter dashboard (`infrastructure/grafana/dashboards/distrotask-overview.json`).

---

## 3. Service Boundary & Trust Model

Two distinct authentication mechanisms exist by design:

- **End users** (dashboard) authenticate with JWT access/refresh tokens via `AuthModule`.
- **Worker processes** authenticate with a single shared secret (`WORKER_SERVICE_TOKEN`) sent as an `x-worker-token` header. Worker-facing routes (`/workers/register`, `/workers/:id/heartbeat`, `/tasks/:id/status`, `/tasks/:id/logs`) are marked `@Public()` (bypassing the JWT guard) but protected by a separate `WorkerServiceGuard` — they are never actually open to the public internet without a valid token.

This split exists because a worker is a trusted internal service, not an end user with a profile/session — issuing it a JWT would add unnecessary complexity (token refresh, expiry handling) for a process that's expected to run indefinitely.

---

## 4. Queue Architecture

RabbitMQ topology (declared once, idempotently, in `RabbitMQConnectionManager.assertTopology()`):

```
                          ┌─────────────────────────────┐
   Task created  ────────▶│  distrotask.tasks.exchange   │  (direct exchange)
   (API publishes)        └───────────┬─────────────────┘
                                       │ routed by priority
                    ┌──────────────────┼──────────────────┬──────────────────┐
                    ▼                  ▼                  ▼                  ▼
            queue.critical      queue.high          queue.normal        queue.low
                    │                  │                  │                  │
                    └──────────────────┴──────────────────┴──────────────────┘
                                       │  consumed by Worker(s)
                                       ▼
                              Worker executes task
                                       │
                       success ────────┴──────── failure
                          │                          │
                          ▼                          ▼
                    Task COMPLETED          attempt < maxRetries?
                                              │              │
                                            yes              no
                                              │              │
                                              ▼              ▼
                                  retry.exchange      DLX (fanout)
                               (TTL-tiered queues)          │
                                              │              ▼
                                 TTL expires  │      distrotask.dlq
                                              ▼
                                  redelivered to tasks.exchange
                                  (same routing key, attempt+1)
```

**Why four separate queues instead of one queue with message priority?** RabbitMQ's native `x-max-priority` only orders messages *within a single queue's prefetch window* and degrades under high throughput. Four physically separate queues guarantee a CRITICAL task is never stuck behind a backlog of LOW priority work, at the cost of a worker needing to consume from all four (handled transparently by `TaskConsumer`).

**Why TTL+DLX for retries instead of a scheduler?** RabbitMQ has no native delayed-delivery without an extra plugin. The standard pattern — a dedicated queue per retry tier with a fixed `message-ttl`, dead-lettering back onto the main exchange on expiry — achieves delayed redelivery using only core RabbitMQ features, keeping the infrastructure dependency surface minimal.

Full constants/topology: `packages/rabbitmq/src/connection-manager.ts`, `packages/shared/src/constants/queue.constants.ts`.

---

## 5. Database Architecture

Six core models (`prisma/schema.prisma`):

```
User ──┬──< Task >──┬── Worker
       │            │
       │            └──< TaskLog
       │
       └──< TaskSchedule >──< Task (scheduled spawns)

Worker ──< WorkerMetric
```

| Model | Purpose |
|---|---|
| `User` | Account, role (ADMIN/OPERATOR/VIEWER), hashed password, hashed refresh token |
| `Task` | The core entity — status, priority, payload/result (JSON), retry bookkeeping, timing |
| `TaskLog` | Append-only execution log lines, streamed live to the dashboard |
| `Worker` | Registered worker process identity, current load, health status |
| `WorkerMetric` | Time-series snapshots (CPU/memory/throughput) per worker, written on every heartbeat |
| `TaskSchedule` | Cron/interval/one-time recurring task definitions (see `docs/system-design.md` for the scheduler flow) |

Indexing strategy prioritizes the dashboard's actual query patterns: `Task` is indexed on `status`, `priority`, `(queueName, status)`, `createdById`, `workerId`, and `nextRetryAt` — covering the Tasks page filters, the monitoring aggregation queries, and the stale-retry sweep.

---

## 6. Worker Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Worker Process                       │
│                                                                │
│  main.ts                                                      │
│   ├─ ApiClient (registers, sends heartbeats, reports status)  │
│   ├─ RabbitMQConnectionManager (shared package)                │
│   ├─ WorkerConsumerLoop                                        │
│   │    ├─ wraps TaskConsumer (shared package)                  │
│   │    ├─ filters messages by configured WORKER_QUEUES         │
│   │    └─ tracks in-flight count for heartbeat reporting       │
│   ├─ TaskRunner                                                 │
│   │    ├─ resolves executor via ExecutorRegistry                │
│   │    ├─ reports RUNNING → COMPLETED / FAILED / RETRYING       │
│   │    └─ records Prometheus counters/histograms                │
│   ├─ HeartbeatService (10s interval, CPU/memory sampling)       │
│   └─ Express server: /health, /metrics                          │
└─────────────────────────────────────────────────────────────┘
```

Executors are registered by `type` string (e.g. `email.send`, `report.generate`) in `apps/worker/src/executors/built-in.executors.ts`. Adding a new task type means writing one new executor function and registering it — no changes to the consumer loop, retry logic, or status-reporting plumbing are required.

---

## 7. Monitoring Architecture

Three layers of observability, each serving a different audience:

1. **Dashboard (Monitoring/Analytics pages)** — human-readable, real-time, backed by `MonitoringModule`'s aggregate Prisma queries plus live RabbitMQ queue-depth polling, pushed every 5s over WebSocket.
2. **Prometheus** — machine-readable time series, scraped from both API and Worker `/metrics` endpoints. Custom metrics: `distrotask_tasks_created_total`, `distrotask_worker_tasks_processed_total`, `distrotask_queue_depth`, `distrotask_http_request_duration_seconds`, `distrotask_worker_task_duration_seconds`.
3. **Grafana** — pre-provisioned dashboard visualizing the Prometheus metrics for ops/on-call use, separate from the operator-facing Next.js dashboard.

See `docs/system-design.md` for the full data flow sequence diagrams.
