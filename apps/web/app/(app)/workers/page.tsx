'use client';

import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { WorkerStatusBadge } from '@/components/ui/badge';
import { useWorkers } from '@/hooks/use-workers';
import { formatDistanceToNow } from 'date-fns';

export default function WorkersPage() {
  const { data: workers, isLoading } = useWorkers();

  return (
    <>
      <Header title="Workers" />
      <div className="px-6 py-6">
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-raised text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Hostname</th>
                <th className="px-4 py-3 font-medium">Load</th>
                <th className="px-4 py-3 font-medium">Accepts</th>
                <th className="px-4 py-3 font-medium">Last Heartbeat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    Loading workers…
                  </td>
                </tr>
              )}
              {!isLoading && workers?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No workers have registered yet. Start a worker process to see it here.
                  </td>
                </tr>
              )}
              {workers?.map((worker) => (
                <tr key={worker.id} className="hover:bg-surface-raised/50">
                  <td className="px-4 py-3 font-mono text-foreground">{worker.name}</td>
                  <td className="px-4 py-3">
                    <WorkerStatusBadge status={worker.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {worker.hostname} <span className="text-muted-foreground/60">(pid {worker.pid})</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs tabular-nums text-foreground">
                      {worker.currentTaskCount}/{worker.concurrency}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {worker.queues.slice(0, 3).map((q) => (
                        <span
                          key={q}
                          className="rounded-sm border border-border-subtle bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                        >
                          {q}
                        </span>
                      ))}
                      {worker.queues.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{worker.queues.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {worker.lastHeartbeatAt
                      ? formatDistanceToNow(new Date(worker.lastHeartbeatAt), { addSuffix: true })
                      : 'never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
