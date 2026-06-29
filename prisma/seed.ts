/**
 * DistroTask seed script.
 *
 * Run with: npm run db:seed
 *
 * Idempotent — safe to run multiple times. Creates (or reuses) a default
 * admin account and a small set of demo tasks across different statuses so
 * the dashboard has something to display immediately after a fresh clone,
 * without needing to manually click through the UI or hit the API by hand.
 *
 * This does NOT publish any task to RabbitMQ — it writes directly to
 * Postgres so it works even if the broker isn't running yet. The demo
 * tasks are inserted in a mix of terminal/non-terminal statuses purely for
 * visual variety on the dashboard; they are not "real" in-flight jobs.
 */
import { PrismaClient, TaskStatus, TaskPriority, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = 'admin@distrotask.local';
const DEFAULT_ADMIN_PASSWORD = 'Admin12345';

async function main() {
  console.log('Seeding DistroTask database...');

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    update: {},
    create: {
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
    },
  });
  console.log(`Admin user ready: ${admin.email} (password: ${DEFAULT_ADMIN_PASSWORD})`);

  const demoTasks: Array<{
    name: string;
    type: string;
    payload: Record<string, unknown>;
    status: TaskStatus;
    priority: TaskPriority;
    result?: Record<string, unknown>;
    errorMessage?: string;
  }> = [
    {
      name: 'Welcome email — demo user',
      type: 'email.send',
      payload: { to: 'demo@example.com', subject: 'Welcome to DistroTask' },
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.NORMAL,
      result: { messageId: 'seed-msg-001', deliveredTo: 'demo@example.com' },
    },
    {
      name: 'Monthly usage report',
      type: 'report.generate',
      payload: { reportType: 'usage', rangeStart: '2026-05-01', rangeEnd: '2026-05-31' },
      status: TaskStatus.RUNNING,
      priority: TaskPriority.HIGH,
    },
    {
      name: 'Webhook — order.created',
      type: 'webhook.deliver',
      payload: { url: 'https://example.com/webhooks/orders' },
      status: TaskStatus.QUEUED,
      priority: TaskPriority.CRITICAL,
    },
    {
      name: 'Webhook — payment.failed (retrying)',
      type: 'webhook.deliver',
      payload: { url: 'https://example.com/webhooks/payments' },
      status: TaskStatus.RETRYING,
      priority: TaskPriority.HIGH,
      errorMessage: 'Connection timed out after 5000ms',
    },
    {
      name: 'Stale export job',
      type: 'report.generate',
      payload: { reportType: 'export' },
      status: TaskStatus.FAILED,
      priority: TaskPriority.LOW,
      errorMessage: 'Exceeded max retries (3)',
    },
  ];

  for (const t of demoTasks) {
    const existing = await prisma.task.findFirst({ where: { name: t.name, createdById: admin.id } });
    if (existing) {
      console.log(`Skipping existing demo task: ${t.name}`);
      continue;
    }

    await prisma.task.create({
      data: {
        name: t.name,
        type: t.type,
        payload: t.payload,
        status: t.status,
        priority: t.priority,
        createdById: admin.id,
        result: t.result,
        errorMessage: t.errorMessage,
        queuedAt: t.status !== TaskStatus.PENDING ? new Date() : null,
        startedAt: ['RUNNING', 'COMPLETED', 'FAILED', 'RETRYING'].includes(t.status) ? new Date() : null,
        completedAt: ['COMPLETED', 'FAILED'].includes(t.status) ? new Date() : null,
      },
    });
    console.log(`Created demo task: ${t.name} [${t.status}]`);
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
