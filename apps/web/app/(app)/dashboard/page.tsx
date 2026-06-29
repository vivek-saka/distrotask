'use client';

import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardValue, CardContent } from '@/components/ui/card';
import { useSystemMetrics, useActiveWorkerCount } from '@/hooks/use-workers';
import { useSocketStore } from '@/store/socket.store';
import { TaskStatusBadge } from '@/components/ui/badge';
import { useTasks } from '@/hooks/use-tasks';
import { formatDistanceToNow } from 'date-fns';

export default function OverviewPage() {
  const liveMetrics = useSocketStore((s) => s.systemMetrics);
  const { data: polledMetrics } = useSystemMetrics();
  const metrics = liveMetrics ?? polledMetrics;
  const { data: workerCount } = useActiveWorkerCount();
  const { data: recentTasks } = useTasks({ pageSize: 8 });

  return (
    <>
      <Header title="Overview" />
      <div className="px-6 py-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Workers</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue>
                {workerCount?.active ?? '—'}
                <span className="text-sm font-normal text-muted-foreground"> / {workerCount?.total ?? '—'}</span>
              </CardValue>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className="text-signal-success">
                {metrics ? `${metrics.successRate}%` : '—'}
              </CardValue>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Failure Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className="text-signal-danger">{metrics ? `${metrics.failureRate}%` : '—'}</CardValue>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Throughput (per min)</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue>{metrics?.throughputPerMinute ?? '—'}</CardValue>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Running</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className="text-signal-running">{metrics?.runningCount ?? '—'}</CardValue>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Queued</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className="text-signal-queued">{metrics?.queuedCount ?? '—'}</CardValue>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Retrying</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className="text-signal-warning">{metrics?.retryingCount ?? '—'}</CardValue>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Avg. Processing Time</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue>{metrics ? `${metrics.avgProcessingTimeMs}ms` : '—'}</CardValue>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="flex flex-col divide-y divide-border-subtle">
                {recentTasks?.data.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted">No tasks yet — create one to get started.</p>
                )}
                {recentTasks?.data.map((task) => (
                  <div key={task.id} className="flex items-center justify-between py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-foreground">{task.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{task.type}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                      </span>
                      <TaskStatusBadge status={task.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
