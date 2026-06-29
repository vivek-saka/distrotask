# DistroTask — Deployment Guide

## 1. Local Setup (without Docker)

Requires Node.js 20+, a local PostgreSQL 16, Redis 7, and RabbitMQ 3.13 (or remote instances of each).

```bash
git clone <repo-url> distrotask && cd distrotask
cp .env.example .env        # edit values — see Section 4 below
npm install                 # installs all workspaces (apps/* + packages/*)

# Build the shared packages first — apps/api and apps/worker depend on their dist output
npm run build --workspace=@distrotask/shared
npm run build --workspace=@distrotask/rabbitmq

# Generate the Prisma client and run migrations against your local Postgres
npm run db:generate
npm run db:migrate

# Run each service in its own terminal
npm run dev --workspace=@distrotask/api      # http://localhost:3001
npm run dev --workspace=@distrotask/worker   # consumes from RabbitMQ
npm run dev --workspace=@distrotask/web      # http://localhost:3000
```

Swagger docs: `http://localhost:3001/api/docs`. Register the first account via the dashboard or `POST /api/v1/auth/register` — it becomes the system admin automatically.

## 2. Docker Setup (recommended)

```bash
cp .env.example .env   # edit values, especially JWT_SECRET / WORKER_SERVICE_TOKEN for anything beyond local dev
docker compose up --build
```

This brings up all 8 services: `postgres`, `redis`, `rabbitmq`, `api`, `worker` (2 replicas by default), `web`, `prometheus`, `grafana`. The `api` container's entrypoint (`infrastructure/docker/api-entrypoint.sh`) runs `prisma migrate deploy` automatically before starting the server — no manual migration step needed.

| Service | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| Swagger | http://localhost:3001/api/docs |
| RabbitMQ management UI | http://localhost:15672 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3030 (default admin/admin unless overridden in `.env`) |

Scale workers horizontally:
```bash
docker compose up --scale worker=4
```

Tear down (and optionally wipe volumes):
```bash
docker compose down            # keep data
docker compose down -v         # also delete Postgres/Redis/RabbitMQ/Grafana volumes
```

## 3. Production Deployment

The same `docker-compose.yml` is a reasonable starting point for a single-host production deployment behind Nginx (see `infrastructure/nginx/nginx.conf` and `docs/architecture.md` Section 3 for the trust-boundary rationale). For a "real" production rollout:

1. **Secrets**: never ship `.env` with real secrets in source control. Generate strong values:
   ```bash
   openssl rand -base64 48   # JWT_SECRET, JWT_REFRESH_SECRET, WORKER_SERVICE_TOKEN
   ```
   Inject via your platform's secret manager (Docker secrets, AWS Secrets Manager, k8s Secrets, etc.) rather than a committed `.env`.
2. **Database**: point `DATABASE_URL` at a managed Postgres instance (RDS, Cloud SQL, etc.) rather than the bundled `postgres` container; run `npx prisma migrate deploy` as a release step.
3. **TLS**: terminate TLS at Nginx (or your load balancer) using a real certificate (Let's Encrypt via certbot, or your cloud provider's managed cert). The provided `nginx.conf` includes a commented SSL server block template.
4. **Reverse proxy routing**: Nginx routes `/` to the Next.js container, `/api/` to the NestJS API, and `/ws/` to the WebSocket gateway with `Upgrade`/`Connection` headers preserved — see `infrastructure/nginx/nginx.conf`.
5. **Horizontal scaling**: run multiple `api` replicas behind Nginx's upstream block; add the Socket.IO Redis adapter (see `docs/system-design.md` Section 4) before scaling past one API replica, so WebSocket broadcasts stay consistent across instances.
6. **Worker scaling**: workers are fully stateless — scale by replica count to match RabbitMQ throughput needs.
7. **Graceful shutdown**: both `main.ts` (`app.enableShutdownHooks()`) and the worker (`SIGTERM`/`SIGINT` handlers in `apps/worker/src/main.ts`) drain in-flight work and close connections cleanly on container stop/redeploy — make sure your orchestrator's shutdown grace period (e.g. Kubernetes `terminationGracePeriodSeconds`) is long enough for an in-flight task to finish (default assumption: 30s).

## 4. Environment Variables

See `.env.example` for the full, always-current list with inline comments. Summary:

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | API | Postgres connection string |
| `REDIS_URL` | API | Redis connection string |
| `RABBITMQ_URL` | API, Worker | AMQP connection string |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | API | Access token signing |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | API | Refresh token signing |
| `WORKER_SERVICE_TOKEN` | API, Worker | Shared secret for worker-to-API callbacks — must match on both sides |
| `CORS_ORIGIN` | API | Dashboard origin allowed to call the API |
| `API_BASE_URL` | Worker | Where the worker reaches the API (e.g. `http://api:3001` inside Docker) |
| `WORKER_NAME` / `WORKER_QUEUES` / `WORKER_CONCURRENCY` | Worker | Identity and capacity per worker instance |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` | Web | Baked in at build time — public, browser-visible |
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | Grafana | Change from the default before any non-local deployment |

## 5. Monitoring Setup

Prometheus and Grafana are provisioned automatically by `docker compose up` — no manual dashboard import needed:
- `infrastructure/prometheus/prometheus.yml` — scrape targets (API + each worker replica)
- `infrastructure/grafana/provisioning/datasources/datasource.yml` — auto-registers Prometheus as the default datasource
- `infrastructure/grafana/dashboards/distrotask-overview.json` — starter dashboard (active workers, task throughput, queue depth, task outcome rate, p95/p99 latency)

To add a custom panel, edit the dashboard JSON directly or build one in the Grafana UI and export it back into that file so it survives a `docker compose down -v`.

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| API container unhealthy / restarting | Migrations failing, or Postgres not yet ready | Check `docker compose logs api` — the entrypoint waits on `depends_on: postgres: condition: service_healthy`, but a slow first-boot Postgres can still race; re-run `docker compose up` |
| Worker logs "worker registration failed... retrying" | API not yet healthy, or `WORKER_SERVICE_TOKEN` mismatch | Confirm the same `WORKER_SERVICE_TOKEN` value in both the `api` and `worker` service env blocks |
| Tasks stuck in `PENDING`, never reach `QUEUED` | RabbitMQ unreachable at task-creation time | Check `docker compose logs rabbitmq`; the task row is safe (not lost) — once the broker is back, re-publish manually via `POST /tasks/:id/retry` or build a reconciliation sweep (see `docs/system-design.md` roadmap) |
| Dashboard shows "offline" / no live updates | WebSocket connection rejected | Check the browser console for a 401 on the `/ws` namespace — usually an expired access token; the dashboard should auto-redirect to `/login` on a 401 from the REST API, but the socket connection itself doesn't currently trigger that redirect (known gap — refresh the page after logging back in) |
| `prisma generate` fails with a 403 / checksum error | Sandboxed/restricted network blocking `binaries.prisma.sh` | This only affects fully air-gapped or domain-allowlisted CI/dev environments; it works normally in Docker and on a standard developer machine with full internet access |
| Grafana shows "No data" | Prometheus hasn't scraped yet, or the metric name changed | Wait one scrape interval (10s); confirm `curl localhost:3001/api/v1/monitoring/prometheus` returns metrics directly |
