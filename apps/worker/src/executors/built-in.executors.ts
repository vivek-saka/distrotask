import { executorRegistry, ExecutorContext } from './executor-registry';
import { sleep } from '@distrotask/shared';

/**
 * Example executors shipped with DistroTask to demonstrate the executor
 * pattern end-to-end. In a real deployment these would be replaced with
 * actual business logic (an email provider SDK call, a PDF generation
 * library, a real outbound webhook POST, etc).
 */

executorRegistry.register('email.send', async (payload, ctx: ExecutorContext) => {
  const { to, subject } = payload as { to?: string; subject?: string };
  if (!to) {
    throw new Error('email.send requires a "to" field in the payload');
  }

  await ctx.log(`Sending email to ${to} (subject: "${subject ?? '(no subject)'}")`);
  await sleep(500); // simulate provider latency
  await ctx.log('Email accepted by provider');

  return { messageId: `sim-${ctx.taskId}-${ctx.attempt}`, deliveredTo: to };
});

executorRegistry.register('report.generate', async (payload, ctx: ExecutorContext) => {
  const { reportType, rangeStart, rangeEnd } = payload as {
    reportType?: string;
    rangeStart?: string;
    rangeEnd?: string;
  };

  await ctx.log(`Generating ${reportType ?? 'unknown'} report for range ${rangeStart} - ${rangeEnd}`);
  await sleep(1500);
  await ctx.log('Report generation complete');

  return {
    reportUrl: `https://reports.distrotask.local/${ctx.taskId}.pdf`,
    generatedAt: new Date().toISOString(),
  };
});

executorRegistry.register('webhook.deliver', async (payload, ctx: ExecutorContext) => {
  const { url } = payload as { url?: string };
  if (!url) {
    throw new Error('webhook.deliver requires a "url" field in the payload');
  }

  await ctx.log(`Delivering webhook to ${url}`);
  await sleep(300);

  // Simulated failure injection for demoing retry/backoff behavior:
  // payload.simulateFailureUntilAttempt lets a demo task fail N times
  // before succeeding, to visibly exercise the RETRYING -> QUEUED loop.
  const failUntil = (payload as { simulateFailureUntilAttempt?: number }).simulateFailureUntilAttempt;
  if (failUntil && ctx.attempt < failUntil) {
    throw new Error(`Simulated transient failure (attempt ${ctx.attempt} of ${failUntil})`);
  }

  await ctx.log('Webhook delivered successfully');
  return { statusCode: 200, deliveredAt: new Date().toISOString() };
});

executorRegistry.register('demo.long-running', async (payload, ctx: ExecutorContext) => {
  const durationMs = (payload as { durationMs?: number }).durationMs ?? 5000;
  const steps = 5;
  const stepDelay = durationMs / steps;

  for (let i = 1; i <= steps; i++) {
    await sleep(stepDelay);
    await ctx.log(`Progress: step ${i}/${steps}`);
  }

  return { completedSteps: steps, totalDurationMs: durationMs };
});
