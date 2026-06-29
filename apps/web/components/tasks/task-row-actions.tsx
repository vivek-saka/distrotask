'use client';

import { Ban, RotateCcw, Trash2 } from 'lucide-react';
import { TaskDto } from '@distrotask/shared';
import { Button } from '@/components/ui/button';
import { useCancelTask, useRetryTask, useDeleteTask } from '@/hooks/use-tasks';

const CANCELLABLE = ['PENDING', 'QUEUED', 'RUNNING', 'RETRYING'];
const RETRYABLE = ['FAILED', 'DEAD_LETTERED'];
const DELETABLE = ['COMPLETED', 'FAILED', 'CANCELLED', 'DEAD_LETTERED'];

export function TaskRowActions({ task }: { task: TaskDto }) {
  const cancelTask = useCancelTask();
  const retryTask = useRetryTask();
  const deleteTask = useDeleteTask();

  return (
    <div className="flex items-center gap-1">
      {CANCELLABLE.includes(task.status) && (
        <Button
          variant="ghost"
          size="icon"
          title="Cancel"
          onClick={() => cancelTask.mutate(task.id)}
          disabled={cancelTask.isPending}
        >
          <Ban className="h-3.5 w-3.5 text-signal-warning" />
        </Button>
      )}
      {RETRYABLE.includes(task.status) && (
        <Button
          variant="ghost"
          size="icon"
          title="Retry"
          onClick={() => retryTask.mutate(task.id)}
          disabled={retryTask.isPending}
        >
          <RotateCcw className="h-3.5 w-3.5 text-signal-running" />
        </Button>
      )}
      {DELETABLE.includes(task.status) && (
        <Button
          variant="ghost"
          size="icon"
          title="Delete"
          onClick={() => {
            if (confirm(`Delete task "${task.name}"? This cannot be undone.`)) {
              deleteTask.mutate(task.id);
            }
          }}
          disabled={deleteTask.isPending}
        >
          <Trash2 className="h-3.5 w-3.5 text-signal-danger" />
        </Button>
      )}
    </div>
  );
}
