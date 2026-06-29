'use client';

import { useSocket } from '@/hooks/use-socket';
import { useSocketStore } from '@/store/socket.store';
import { QueuePulseStrip } from './queue-pulse-strip';
import { cn } from '@/lib/utils';

export function Header({ title }: { title: string }) {
  useSocket(); // establishes/maintains the connection for the whole authenticated app
  const connected = useSocketStore((s) => s.connected);

  return (
    <header className="flex items-center justify-between border-b border-border-subtle bg-background px-6 py-4">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-3">
        <QueuePulseStrip />
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-signal-success' : 'bg-signal-danger')}
          />
          {connected ? 'live' : 'offline'}
        </div>
      </div>
    </header>
  );
}
