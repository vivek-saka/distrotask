'use client';

import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardValue, CardContent } from '@/components/ui/card';
import { useQueueMetrics, useSystemMetrics } from '@/hooks/use-workers';
import { useSocketStore } from '@/store/socket.store';
import { AlertTriangle } from 'lucide-react';

const PRIORITY_LABELS: Record<string, string> = {
  'distrotask.queue.critical': 'Critical',
  'distrotask.queue.high': 'High',
  'distrotask.queue.normal': 'Normal',
  'distrotask.queue.low': 'Low',
};

const PRIORITY_COLORS: Record<string, string> = {
  'distrotask.queue.critical': 'bg-priority-critical',
  'distrotask.queue.high': 'bg-priority-high',
  'distrotask.queue.normal': 'bg-priority-normal',
  'distrotask.queue.low': 'bg-priority-low',
};

export default function MonitoringPage() {
  const liveQueues = useSocketStore((s) => s.queueMetrics);
  const { data: polled } = useQueueMetrics();
  const queues = liveQueues.length > 0 ? liveQueues : (polled?.queues ?? []);
  const deadLetterDepth = polled?.deadLetterDepth ?? 0;

  const liveMetrics = useSocketStore((s) => s.systemMetrics);
  const { data: polledMetrics } = useSystemMetrics();
  const metrics = liveMetrics ?? polledMetrics;

  const maxDepth = Math.max(...queues.map((q) => q.depth), 1);

  return (
    <>
      <Header title="Monitoring" />
      <div className="px-6 py-6">
        {deadLetterDepth > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-sm border border-signal-danger/30 bg-signal-danger/10 px-4 py-3 text-sm text-signal-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {deadLetterDepth} task{deadLetterDepth === 1 ? '' : 's'} sitting in the dead letter queue — these
            exhausted all retry attempts and need manual review.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Queue Depth by Priority</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-2">
              {queues.map((q) => (
                <div key={q.queueName} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">
                    {PRIORITY_LABELS[q.queueName] ?? q.queueName}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
                    <div
                      className={`h-full rounded-full ${PRIORITY_COLORS[q.queueName] ?? 'bg-signal-neutral'}`}
                      style={{ width: `${(q.depth / maxDepth) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">
                    {q.depth}
                  </span>
                </div>
              ))}
              {queues.length === 0 && <p className="text-sm text-muted">No queue data yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dead Letter Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className={deadLetterDepth > 0 ? 'text-signal-danger' : 'text-signal-success'}>
                {deadLetterDepth}
              </CardValue>
              <p className="mt-1 text-xs text-muted-foreground">
                Tasks that permanently failed after exhausting all retry attempts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-y-2 pt-2 text-sm">
              <StatusRow label="Pending" value={metrics?.pendingCount} />
              <StatusRow label="Queued" value={metrics?.queuedCount} />
              <StatusRow label="Running" value={metrics?.runningCount} />
              <StatusRow label="Completed" value={metrics?.completedCount} />
              <StatusRow label="Failed" value={metrics?.failedCount} />
              <StatusRow label="Retrying" value={metrics?.retryingCount} />
              <StatusRow label="Cancelled" value={metrics?.cancelledCount} />
              <StatusRow label="Dead lettered" value={metrics?.deadLetteredCount} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Worker Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue>
                {metrics ? `${metrics.activeWorkerCount}/${metrics.totalWorkerCount}` : '—'}
              </CardValue>
              <p className="mt-1 text-xs text-muted-foreground">Active workers / total registered</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function StatusRow({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-foreground">{value ?? '—'}</span>
    </div>
  );
}
