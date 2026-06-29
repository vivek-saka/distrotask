import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'running' | 'warning' | 'danger' | 'neutral' | 'queued';

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-signal-success/10 text-signal-success border-signal-success/30',
  running: 'bg-signal-running/10 text-signal-running border-signal-running/30',
  warning: 'bg-signal-warning/10 text-signal-warning border-signal-warning/30',
  danger: 'bg-signal-danger/10 text-signal-danger border-signal-danger/30',
  neutral: 'bg-signal-neutral/10 text-signal-neutral border-signal-neutral/30',
  queued: 'bg-signal-queued/10 text-signal-queued border-signal-queued/30',
};

export function Badge({
  children,
  variant = 'neutral',
  pulse = false,
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium uppercase tracking-wide',
        variantStyles[variant],
        className,
      )}
    >
      {pulse && <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse-dot bg-current')} aria-hidden />}
      {children}
    </span>
  );
}

const TASK_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: 'neutral',
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'success',
  FAILED: 'danger',
  RETRYING: 'warning',
  CANCELLED: 'neutral',
  DEAD_LETTERED: 'danger',
};

export function TaskStatusBadge({ status }: { status: string }) {
  const variant = TASK_STATUS_VARIANT[status] ?? 'neutral';
  const isLive = status === 'RUNNING' || status === 'RETRYING';
  return (
    <Badge variant={variant} pulse={isLive}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

const WORKER_STATUS_VARIANT: Record<string, BadgeVariant> = {
  ONLINE: 'success',
  IDLE: 'success',
  BUSY: 'running',
  OFFLINE: 'danger',
  DRAINING: 'warning',
};

export function WorkerStatusBadge({ status }: { status: string }) {
  const variant = WORKER_STATUS_VARIANT[status] ?? 'neutral';
  const isLive = status === 'BUSY' || status === 'ONLINE' || status === 'IDLE';
  return (
    <Badge variant={variant} pulse={isLive}>
      {status}
    </Badge>
  );
}

const PRIORITY_VARIANT: Record<string, BadgeVariant> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  NORMAL: 'running',
  LOW: 'neutral',
};

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge variant={PRIORITY_VARIANT[priority] ?? 'neutral'}>{priority}</Badge>;
}
