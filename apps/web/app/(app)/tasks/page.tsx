'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TaskStatusBadge, PriorityBadge } from '@/components/ui/badge';
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog';
import { TaskRowActions } from '@/components/tasks/task-row-actions';
import { useTasks } from '@/hooks/use-tasks';
import { formatDistanceToNow } from 'date-fns';

const STATUS_OPTIONS = [
  'PENDING',
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'RETRYING',
  'CANCELLED',
  'DEAD_LETTERED',
];
const PRIORITY_OPTIONS = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'];

export default function TasksPage() {
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useTasks({
    status: status || undefined,
    priority: priority || undefined,
    search: search || undefined,
    page,
    pageSize: 20,
  });

  return (
    <>
      <Header title="Tasks" />
      <div className="px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search by name or type…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-56"
            />
            <select
              className="h-9 rounded-sm border border-border bg-surface px-3 text-sm text-foreground"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-sm border border-border bg-surface px-3 text-sm text-foreground"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All priorities</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <CreateTaskDialog />
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-raised text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Retries</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    Loading tasks…
                  </td>
                </tr>
              )}
              {!isLoading && data?.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    No tasks match these filters.
                  </td>
                </tr>
              )}
              {data?.data.map((task) => (
                <tr key={task.id} className="hover:bg-surface-raised/50">
                  <td className="px-4 py-3 text-foreground">{task.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{task.type}</td>
                  <td className="px-4 py-3">
                    <TaskStatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                    {task.retryCount}/{task.maxRetries}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <TaskRowActions task={task} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {data && data.meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} tasks
            </span>
            <div className="flex gap-2">
              <button
                className="rounded-sm border border-border px-3 py-1 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="rounded-sm border border-border px-3 py-1 disabled:opacity-40"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
