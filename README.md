# DistroTask

**A production-grade distributed task queue system** — the same class of problem solved by Celery, BullMQ, Sidekiq, and AWS SQS+Lambda — built as a microservice-oriented monorepo with a NestJS API, a horizontally-scalable Worker service, RabbitMQ for queueing, PostgreSQL for durable state, real-time WebSocket updates, and a full operations dashboard.

> Built to demonstrate production backend engineering practices: CQRS, message-queue architecture, retry/backoff semantics, dead-letter handling, observability, and a real Docker deployment — not just a CRUD demo.

---

DistroTask is a distributed task processing platform designed to execute long-running and resource-intensive background jobs reliably and efficiently. Instead of processing tasks synchronously inside the API, tasks are stored in PostgreSQL, published to RabbitMQ, and executed asynchronously by scalable worker services based on their priority.

The platform provides real-time task monitoring, worker management, retry mechanisms, dead-letter queues, priority scheduling, WebSocket-based live updates, and system observability through Prometheus and Grafana. Its architecture enables applications to handle background workloads such as email delivery, report generation, image processing, scheduled jobs, and external API integrations without blocking user requests.

---

## Features

**Architecture**
- Microservice-oriented: independent, horizontally-scalable API and Worker services
- Full CQRS (commands, queries, handlers, and a domain event bus) throughout the API
- Shared `@distrotask/shared` and `@distrotask/rabbitmq` packages — one source of truth for types, DTOs, and queue topology, consumed by every service

**Auth**
- JWT access + refresh tokens, with refresh-token rotation and theft/reuse detection
- Role-based access control (`ADMIN` / `OPERATOR` / `VIEWER`)

**Task management**
- Create / update / delete / cancel / retry, with a strictly-enforced status state machine
- Priority levels (`CRITICAL` / `HIGH` / `NORMAL` / `LOW`) routed to physically separate RabbitMQ queues
- Idempotent creation via a deduplication key
- Live execution log streaming per task

**Queueing**
- RabbitMQ topology: priority queues, TTL+DLX-based delayed retry tiers, and a dead letter queue — all declared idempotently in code
- Exponential backoff with jitter on automatic retries

**Workers**
- Pluggable executor registry — adding a new task type is one function registration, no changes to the consumer/retry/reporting plumbing
- Heartbeats with CPU/memory sampling; stale-worker auto-detection (cron sweep)
- Horizontally scalable: `docker compose up --scale worker=4`

**Real-time**
- Socket.IO gateway bridged to the CQRS event bus — task and worker state changes broadcast live, no polling required for the dashboard's core views

**Observability**
- Prometheus metrics from both API and Worker processes
- Pre-provisioned Grafana dashboard
- Aggregate success/failure rate, throughput, and queue-depth endpoints powering the dashboard's Monitoring/Analytics pages

**Dashboard**
- Next.js 15 (App Router), Shadcn-style component primitives, TailwindCSS, React Query, Zustand
- Overview, Tasks, Workers, Monitoring, and Analytics pages, all live-updating

---

## Architecture Diagram

```
                                   ┌─────────────────────┐
                                   │   Next.js Dashboard   │
                                   └──────────┬─────────────┘
                                              │ REST              │ WebSocket
                          ┌───────────────────▼──────────────────▼───────────┐
                          │                  NestJS API Service                │
                          │   Auth | Tasks | Workers | Monitoring  (all CQRS) │
                          │              WebSocket Gateway                     │
                          └───────┬───────────────────┬──────────────────┬────┘
                         ┌────────▼────────┐  ┌────────▼────────┐ ┌──────▼───────┐
                         │   PostgreSQL     │  │    RabbitMQ      │ │    Redis     │
                         └──────────────────┘  └────────┬─────────┘ └──────────────┘
                                                          │
                                          ┌───────────────▼────────────────┐
                                          │     Worker Service (xN)         │
                                          └──────────────────────────────────┘
                          ┌──────────────┐        ┌──────────────┐
                          │  Prometheus   │◄───────│   Grafana     │
                          └──────────────┘        └──────────────┘
```

Full diagrams (component breakdown, sequence diagrams for every flow, queue topology) live in **[`docs/architecture.md`](docs/architecture.md)** and **[`docs/system-design.md`](docs/system-design.md)**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | NestJS, TypeScript, `@nestjs/cqrs`, Prisma, Passport-JWT |
| Worker | Node.js (no framework), amqplib, axios |
| Database | PostgreSQL 16 |
| Queue | RabbitMQ 3.13 (priority queues, TTL+DLX retry, DLQ) |
| Cache | Redis 7 |
| Real-time | Socket.IO |
| Frontend | Next.js 15 (App Router), React 18, TailwindCSS, React Query, Zustand, Recharts |
| Observability | Prometheus, Grafana, Winston |
| Infra | Docker, Docker Compose, Nginx, Turborepo, npm workspaces |
| Testing | Jest, Supertest, ts-jest |

---

## Folder Structure

```
distrotask/
├── apps/
│   ├── api/              NestJS API service (Auth, Tasks, Workers, Monitoring, WebSocket - all CQRS)
│   │   ├── src/
│   │   └── test/e2e/     Supertest e2e suites
│   ├── worker/            Standalone Node.js worker process
│   │   └── src/
│   └── web/               Next.js dashboard
│       ├── app/            pages (App Router)
│       ├── components/
│       ├── hooks/          React Query + WebSocket hooks
│       └── store/          Zustand stores
├── packages/
│   ├── shared/             Types, DTOs, enums, queue constants - used by every app
│   └── rabbitmq/           RabbitMQ connection manager, producer, consumer, queue inspector
├── prisma/
│   └── schema.prisma       6 models: User, Task, TaskLog, Worker, WorkerMetric, TaskSchedule
├── infrastructure/
│   ├── docker/              Dockerfiles for api/worker/web
│   ├── nginx/                Reverse proxy config
│   ├── prometheus/
│   └── grafana/
├── docs/                    architecture.md, system-design.md, api.md, deployment.md
├── .github/workflows/       CI (lint/typecheck/test/build) and Docker build pipelines
└── docker-compose.yml
```

---

## Screenshots

> _Add screenshots of the Overview, Tasks, Workers, and Monitoring pages here once deployed - e.g._
>
> `docs/screenshots/overview.png` · `docs/screenshots/tasks.png` · `docs/screenshots/monitoring.png`

---

## Local Setup

```bash
git clone <repo-url> distrotask && cd distrotask
cp .env.example .env
npm install
npm run build --workspace=@distrotask/shared
npm run build --workspace=@distrotask/rabbitmq
npm run db:generate && npm run db:migrate

npm run dev --workspace=@distrotask/api      # http://localhost:3001
npm run dev --workspace=@distrotask/worker
npm run dev --workspace=@distrotask/web      # http://localhost:3000
```

Full walkthrough: **[`docs/deployment.md`](docs/deployment.md)**.

## Docker Setup

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| API + Swagger | http://localhost:3001/api/docs |
| RabbitMQ management | http://localhost:15672 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3030 |

Scale workers: `docker compose up --scale worker=4`.

## Environment Variables

See **[`.env.example`](.env.example)** for the complete, commented list (database/broker URLs, JWT secrets, the API-to-Worker shared token, dashboard build-time variables). Summary table in **[`docs/deployment.md`](docs/deployment.md#4-environment-variables)**.

## Monitoring

Prometheus and Grafana are auto-provisioned by `docker compose up` — no manual setup. See **[`docs/deployment.md`](docs/deployment.md#5-monitoring-setup)**.

## Deployment

Production rollout guidance (secrets, TLS, reverse-proxy routing, horizontal scaling, graceful shutdown) is in **[`docs/deployment.md`](docs/deployment.md#3-production-deployment)**.

## API Documentation

- Interactive Swagger UI: `http://localhost:3001/api/docs` (always reflects the live schema)
- Human-readable reference with request/response examples: **[`docs/api.md`](docs/api.md)**

---

## Testing

```bash
npm test --workspace=@distrotask/api                 # unit tests
npm run test:e2e --workspace=@distrotask/api          # e2e (requires running Postgres/RabbitMQ)
npm test --workspace=@distrotask/worker
npm test --workspace=@distrotask/shared
npm run test:integration --workspace=@distrotask/rabbitmq   # requires a real RabbitMQ broker
```

---

## License

MIT
