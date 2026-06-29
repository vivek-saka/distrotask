# DistroTask — System Design

## 1. High-Level Design (HLD)

DistroTask solves the same problem as Celery, BullMQ, Sidekiq, and SQS+Lambda: **decouple work submission from work execution**, so submitting a task never blocks on it being processed, processing scales independently of submission, and failures are retried automatically without losing the task.

Design goals, in priority order:
1. **Durability** — a task that's been accepted is never silently lost, even if the broker or a worker crashes mid-execution.
2. **Observability** — every state transition is visible in real time (dashboard) and queryable historically (Postgres) and as metrics (Prometheus).
3. **Horizontal scalability** — both the API and Worker tiers scale by adding stateless replicas.
4. **Operational simplicity** — minimal infrastructure surface (Postgres + RabbitMQ + Redis), no exotic dependencies.

## 2. Low-Level Design (LLD) — CQRS Flow

Every write goes through a `Command` + `CommandHandler` pair; every read goes through a `Query` + `QueryHandler` pair, dispatched via `@nestjs/cqrs`'s `CommandBus`/`QueryBus`. Side effects (WebSocket broadcast) are decoupled from the write path via the `EventBus` — a command handler publishes a domain event (e.g. `TaskStatusChangedEvent`) and returns immediately; a separate `@EventsHandler` in `WebsocketModule` picks it up and broadcasts it.

```
Controller → CommandBus.execute(cmd) → CommandHandler
                                            │
                                            ├─ writes to Postgres (Prisma)
                                            ├─ publishes to RabbitMQ (if applicable)
                                            └─ eventBus.publish(DomainEvent)
                                                    │
                                                    ▼
                                          @EventsHandler (WebsocketModule)
                                                    │
                                                    ▼
                                          gateway.server.to(room).emit(...)
```

The WebSocket gateway has zero knowledge of *how* a task's state changed, only *that* it changed — this is the main practical payoff of CQRS here: the read/broadcast side and the write side can evolve independently.

---

## 3. Sequence Diagrams

### 3.1 Task creation → queueing

```
Dashboard        API (CreateTaskHandler)      Postgres        RabbitMQ        WS Gateway
   │  POST /tasks      │                          │               │               │
   ├──────────────────▶│                          │               │               │
   │                    │  INSERT Task (PENDING)  │               │               │
   │                    ├─────────────────────────▶│               │               │
   │                    │◀─────────────────────────┤               │               │
   │                    │  eventBus.publish(TaskCreatedEvent)      │               │
   │                    ├───────────────────────────────────────────────────────────▶│
   │                    │                          │               │   emit task.created (room: tasks)
   │                    │  publishTask(message)    │               │               │
   │                    ├──────────────────────────────────────────▶│               │
   │                    │  UPDATE Task SET status=QUEUED            │               │
   │                    ├─────────────────────────▶│               │               │
   │                    │◀─────────────────────────┤               │               │
   │                    │  eventBus.publish(TaskStatusChangedEvent) │               │
   │                    ├───────────────────────────────────────────────────────────▶│
   │◀───────────────────┤  201 { task }            │               │   emit task.status_changed
```

**Durability note:** the Postgres write happens *before* the RabbitMQ publish. If the broker publish fails, the task row already exists as `PENDING` — not lost, just not yet queued. A true exactly-once outbox pattern (transactional outbox + relay) would close this gap completely but adds a polling relay process; for this system's current scale, "PENDING tasks remain visible and can be manually or automatically re-published" is the chosen, documented tradeoff. See `apps/api/src/tasks/commands/create-task.command.ts`.

### 3.2 Worker lifecycle (registration → execution → reporting)

```
Worker                  RabbitMQ              API                    Postgres
  │ POST /workers/register │                    │                       │
  ├─────────────────────────────────────────────▶│  UPSERT Worker (ONLINE)
  │                         │                    ├──────────────────────▶│
  │  subscribe(4 queues)    │                    │                       │
  ├────────────────────────▶                    │                       │
  │◀────────────────────────┤  deliver message   │                       │
  │  PATCH /tasks/:id/status (RUNNING)            │                       │
  ├─────────────────────────────────────────────▶│  UPDATE status=RUNNING│
  │                         │                    ├──────────────────────▶│
  │  [executor runs task.type handler]            │                       │
  │  POST /tasks/:id/logs (optional, during run)  │                       │
  ├─────────────────────────────────────────────▶│  INSERT TaskLog       │
  │                         │                    ├──────────────────────▶│
  │  PATCH /tasks/:id/status (COMPLETED | FAILED) │                       │
  ├─────────────────────────────────────────────▶│  UPDATE status, result│
  │                         │                    ├──────────────────────▶│
  │  ack(message)           │                    │                       │
  ├────────────────────────▶│                    │                       │
  │  POST /workers/:id/heartbeat (every 10s)      │                       │
  ├─────────────────────────────────────────────▶│  UPDATE lastHeartbeatAt
```

The worker **acks the message after** reporting terminal status to the API, not before — if it crashes between executing the task and reporting status, RabbitMQ's unacked-message redelivery (on consumer disconnect) ensures the task is retried rather than silently dropped.

### 3.3 Retry flow (automatic, exponential backoff)

```
Worker                API (UpdateTaskStatusHandler)     RabbitMQ
  │ status=RETRYING        │                               │
  ├───────────────────────▶│  retryCount += 1               │
  │                        │  nextRetryAt = now + backoff(n) │
  │                        │  scheduleRetry(message, n)      │
  │                        ├─────────────────────────────────▶│  publish to retry.attempt.N queue
  │                        │                               │  (TTL = backoffTiers[N], e.g. 2s/4s/8s/16s/32s/64s)
  │                        │                               │
  │                        │                       [TTL expires]
  │                        │                               │  dead-lettered → tasks.exchange
  │                        │                               │  (original routing key preserved)
  │                        │                               ▼
  │◀───────────────────────────────────────────── redelivered to priority queue (attempt N+1)
```

Backoff delay: `BASE_DELAY_MS * MULTIPLIER^(attempt-1)`, capped at `MAX_DELAY_MS`, plus random jitter — see `computeBackoffDelayMs()` in `packages/shared/src/constants/queue.constants.ts`.

### 3.4 Dead Letter Queue flow

```
                  attempt > maxRetries?
                          │
                         yes
                          │
                          ▼
            UpdateTaskStatusHandler.scheduleRetry()
                 sets status = DEAD_LETTERED
                 (no further publish to RabbitMQ)
```

A task is dead-lettered at the **application layer** (status flips to `DEAD_LETTERED` in Postgres) once `retryCount > maxRetries`. This is distinct from, but complementary to, RabbitMQ's own infrastructure-layer DLQ (`distrotask.dlq`), which catches messages `nack`'d without requeue for reasons *outside* the normal retry flow (an unparseable message, or a worker that can't reach the API to report status and gives up). The Monitoring page surfaces both: `deadLetteredCount` (Postgres) and `deadLetterDepth` (the RabbitMQ DLQ).

### 3.5 WebSocket flow

```
Client                  Gateway                 CQRS EventBus
  │ connect(auth: jwt)     │                        │
  ├────────────────────────▶  verify JWT             │
  │                         │  join(metrics room)    │
  │◀────────────────────────┤  emit connection.established
  │  emit subscribe(tasks)  │                        │
  ├────────────────────────▶  join(tasks room)       │
  │                         │                        │
  │                         │◀───────────────────────┤  TaskStatusChangedEvent
  │◀────────────────────────┤  emit task.status_changed (to: tasks room)
```

---

## 4. Scaling Strategy

| Tier | Scaling approach |
|---|---|
| **API** | Stateless — scale horizontally behind a load balancer / Nginx upstream. The only shared state is Postgres/Redis/RabbitMQ, all external. WebSocket connections would need a Redis adapter for Socket.IO (`@socket.io/redis-adapter`) once running more than one API replica, so cross-replica room broadcasts stay consistent — noted as a scaling prerequisite, not yet wired in since a single API replica comfortably serves the dashboard's connection volume today. |
| **Worker** | Stateless — `docker compose up --scale worker=N`, or N replicas in Kubernetes. RabbitMQ's `prefetch` + competing-consumers pattern means adding workers linearly increases throughput with no coordination needed. |
| **PostgreSQL** | Vertical scaling first (it's the bottleneck for write-heavy task creation at very high volume); read replicas for the Monitoring/Analytics aggregate queries are a natural next step if dashboard read load becomes significant. |
| **RabbitMQ** | Clustering + mirrored/quorum queues for HA; the topology (4 priority queues + retry tiers + DLQ) is replica-count-independent. |
| **Redis** | Used for caching, not as a single point of correctness — safe to run as a simple managed instance; clustering only needed at very large session/cache volume. |

## 5. Fault Tolerance Strategy

| Failure mode | Mitigation |
|---|---|
| Worker crashes mid-task | Message stays unacked → RabbitMQ redelivers to another consumer once the connection drop is detected. |
| RabbitMQ broker restarts/unreachable | `RabbitMQConnectionManager` auto-reconnects with a fixed backoff and re-asserts topology idempotently. `CreateTaskHandler` tolerates publish failure by leaving the task `PENDING` rather than throwing a 500. |
| API instance crashes | Stateless — a load balancer routes around it; in-flight requests fail but no durable data is lost (writes commit to Postgres before the response is sent). |
| Worker can't reach the API to report status | `ApiClient` methods catch and log rather than throw, so a transient API outage doesn't corrupt the consumer loop; the message is `nack`'d without requeue as a last resort, landing in the DLQ rather than looping forever. |
| Worker misses heartbeats | `WorkerHealthScheduler` (cron, every 30s) sweeps for workers whose `lastHeartbeatAt` exceeds `WORKER_HEARTBEAT_TIMEOUT_MS` (3× the heartbeat interval) and marks them `OFFLINE`. |
| Duplicate task submission | `idempotencyKey` (unique constraint) — a repeated key returns the original task rather than creating a duplicate. |
| Refresh token theft/reuse | Refresh tokens are stored hashed and rotated on every use; presenting an already-rotated-out token triggers defensive revocation of the stored hash, forcing re-authentication. |

## 6. Roadmap Architecture (not yet implemented)

Deliberately scoped out of the current build — each is a legitimate senior-level distributed-systems feature, but adds infrastructure/operational complexity disproportionate to this project's current stage:

- **OpenTelemetry distributed tracing** — would wrap the API's CQRS bus and the Worker's `TaskRunner` in spans, propagating a trace ID through RabbitMQ message headers so a task's full lifecycle (API → broker → worker → API callback) is visible as one trace. Natural integration point: message headers already carry `attempt`/`priority`; a `traceparent` header would follow the same pattern.
- **Notification microservice** — a new consumer of the existing CQRS event bus (subscribing to `TaskStatusChangedEvent` for terminal states) that fans out to email/Slack/webhook. Purely additive — no changes to `TasksModule` required.
- **Task Dependency DAG engine** — would add a `TaskDependency` join table (`dependsOnTaskId`) and a "ready to run" query (`WHERE NOT EXISTS pending dependency`) gating `CreateTaskHandler`'s publish step. The hard part is correct handling of a dependency that fails (cascade-cancel vs. let downstream tasks decide) — deferred pending a clearer product requirement.
- **Multi-queue routing beyond priority** (e.g. per-tenant queues) — the topology is already parameterized by `TaskPriority`; generalizing `QUEUES`/`ROUTING_KEYS` to an arbitrary named-queue scheme is a moderate, well-contained refactor.
- **Kubernetes / service mesh** — Docker Compose is the deployment target for now; a Helm chart would map almost 1:1 onto the existing service boundaries (api/worker/web Deployments, Postgres/Redis/RabbitMQ as StatefulSets or managed services).
