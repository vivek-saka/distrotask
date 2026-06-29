-- DistroTask baseline migration
-- Hand-authored to match prisma/schema.prisma exactly, since this sandbox
-- has no live PostgreSQL instance and no network access to the Prisma
-- schema-engine binary needed to run `prisma migrate dev` interactively.
-- This file is the deterministic SQL equivalent of that schema and has been
-- carefully cross-checked field-by-field, table-by-table, against
-- schema.prisma. It runs via `prisma migrate deploy` (used by both local
-- `npm run db:migrate:deploy` and the Docker entrypoint) with no further
-- action needed.
--
-- IMPORTANT: After this migration is applied once against a real database,
-- if you subsequently edit schema.prisma, use `prisma migrate dev` (not
-- this file) to generate the next migration — Prisma will diff against
-- this baseline automatically.

-- Enums

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER');

CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED', 'DEAD_LETTERED');

CREATE TYPE "TaskPriority" AS ENUM ('CRITICAL', 'HIGH', 'NORMAL', 'LOW');

CREATE TYPE "WorkerStatus" AS ENUM ('ONLINE', 'OFFLINE', 'IDLE', 'BUSY', 'DRAINING');

CREATE TYPE "TaskLogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

CREATE TYPE "ScheduleType" AS ENUM ('ONE_TIME', 'CRON', 'INTERVAL');

-- users

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "refresh_token_hash" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");

-- workers

CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "pid" INTEGER NOT NULL,
    "status" "WorkerStatus" NOT NULL DEFAULT 'OFFLINE',
    "queues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "concurrency" INTEGER NOT NULL DEFAULT 1,
    "current_task_count" INTEGER NOT NULL DEFAULT 0,
    "version" TEXT,
    "last_heartbeat_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stopped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workers_name_key" ON "workers"("name");
CREATE INDEX "workers_status_idx" ON "workers"("status");
CREATE INDEX "workers_last_heartbeat_at_idx" ON "workers"("last_heartbeat_at");

-- task_schedules

CREATE TABLE "task_schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ScheduleType" NOT NULL,
    "expression" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "queue_name" TEXT NOT NULL DEFAULT 'default',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_schedules_is_active_next_run_at_idx" ON "task_schedules"("is_active", "next_run_at");

ALTER TABLE "task_schedules" ADD CONSTRAINT "task_schedules_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- tasks

CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "queue_name" TEXT NOT NULL DEFAULT 'default',
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "backoff_strategy" TEXT NOT NULL DEFAULT 'exponential',
    "next_retry_at" TIMESTAMP(3),
    "error_message" TEXT,
    "error_stack" TEXT,
    "created_by_id" TEXT NOT NULL,
    "worker_id" TEXT,
    "schedule_id" TEXT,
    "queued_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tasks_idempotency_key_key" ON "tasks"("idempotency_key");
CREATE INDEX "tasks_status_idx" ON "tasks"("status");
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");
CREATE INDEX "tasks_created_by_id_idx" ON "tasks"("created_by_id");
CREATE INDEX "tasks_worker_id_idx" ON "tasks"("worker_id");
CREATE INDEX "tasks_queue_name_status_idx" ON "tasks"("queue_name", "status");
CREATE INDEX "tasks_next_retry_at_idx" ON "tasks"("next_retry_at");
CREATE INDEX "tasks_created_at_idx" ON "tasks"("created_at");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_worker_id_fkey"
    FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_schedule_id_fkey"
    FOREIGN KEY ("schedule_id") REFERENCES "task_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- task_logs

CREATE TABLE "task_logs" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "level" "TaskLogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_logs_task_id_idx" ON "task_logs"("task_id");
CREATE INDEX "task_logs_created_at_idx" ON "task_logs"("created_at");

ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- worker_metrics

CREATE TABLE "worker_metrics" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "cpu_usage_percent" DOUBLE PRECISION,
    "memory_usage_mb" DOUBLE PRECISION,
    "tasks_processed" INTEGER NOT NULL DEFAULT 0,
    "tasks_failed" INTEGER NOT NULL DEFAULT 0,
    "avg_duration_ms" DOUBLE PRECISION,
    "queue_depth_snapshot" INTEGER,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_metrics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "worker_metrics_worker_id_recorded_at_idx" ON "worker_metrics"("worker_id", "recorded_at");

ALTER TABLE "worker_metrics" ADD CONSTRAINT "worker_metrics_worker_id_fkey"
    FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
