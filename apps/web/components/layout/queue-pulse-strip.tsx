'use client';

import { useQueueMetrics } from '@/hooks/use-workers';
import { useSocketStore } from '@/store/socket.store';
import { cn } from '@/lib/utils';

const PRIORITY_COLORS: Record<string, string> = {
  'distrotask.queue.critical': 'bg-priority-critical',
  'distrotask.queue.high': 'bg-priority-high',
  'distrotask.queue.normal': 'bg-priority-normal',
  'distrotask.queue.low': 'bg-priority-low',
};

const PRIORITY_LABELS: Record<string, string> = {
  'distrotask.queue.critical': 'CRIT',
  'distrotask.queue.high': 'HIGH',
  'distrotask.queue.normal': 'NORM',
  'distrotask.queue.low': 'LOW',
};

/**
 * The dashboard's signature visual: a row of live dots, one per priority
 * queue, that pulse and grow when depth backs up — a heartbeat-monitor
 * metaphor for "is the queue system breathing normally or backing up".
 * Lives permanently in the header so the system's pulse is always visible,
 * never buried in a sub-page.
 */
export function QueuePulseStrip() {
  const liveQueues = useSocketStore((s) => s.queueMetrics);
  const { data: polled } = useQueueMetrics();
  const queues = liveQueues.length > 0 ? liveQueues : (polled?.queues ?? []);

  return (
    <div className="flex items-center gap-4 rounded-sm border border-border-subtle bg-surface px-3 py-1.5">
      {queues.length === 0 ? (
        <span className="text-xs text-muted-foreground">connecting…</span>
      ) : (
        queues.map((q) => {
          const isBacked = q.depth > 50;
          const isBusy = q.depth > 0;
          return (
            <div
              key={q.queueName}
              className="flex items-center gap-1.5"
              title={`${q.queueName}: ${q.depth} queued`}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  PRIORITY_COLORS[q.queueName] ?? 'bg-signal-neutral',
                  isBusy && 'animate-pulse-dot',
                  isBacked && 'h-2.5 w-2.5',
                )}
              />
              <span className="font-mono text-[10px] font-medium text-muted-foreground">
                {PRIORITY_LABELS[q.queueName] ?? '?'}
              </span>
              <span className="font-mono text-xs tabular-nums text-foreground">{q.depth}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
