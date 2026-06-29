'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ListChecks, Cpu, Activity, BarChart3, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { disconnectSocket } from '@/hooks/use-socket';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/workers', label: 'Workers', icon: Cpu },
  { href: '/monitoring', label: 'Monitoring', icon: Activity },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const router = useRouter();

  const handleLogout = () => {
    disconnectSocket();
    clearAuth();
    router.push('/login');
  };

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="h-2.5 w-2.5 rounded-full bg-signal-success animate-pulse-dot" />
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">DistroTask</span>
      </div>

      <nav className="flex-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'mb-1 flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-surface-raised text-foreground'
                  : 'text-muted hover:bg-surface-raised hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-subtle px-3 py-4">
        {user && (
          <div className="mb-2 px-3 text-xs text-muted-foreground">
            <div className="truncate font-medium text-muted">
              {user.firstName} {user.lastName}
            </div>
            <div className="truncate">{user.role}</div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-signal-danger transition-colors"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Log out
        </button>
      </div>
    </aside>
  );
}
