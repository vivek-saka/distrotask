'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent, CardValue } from '@/components/ui/card';
import { useSystemMetrics } from '@/hooks/use-workers';
import { useSocketStore } from '@/store/socket.store';

const STATUS_COLORS: Record<string, string> = {
  Completed: '#00D9A3',
  Failed: '#FF6B5B',
  Running: '#5B8DEF',
  Queued: '#B68CFF',
  Retrying: '#FFB454',
  Pending: '#8B92A8',
  Cancelled: '#5C6480',
  'Dead lettered': '#FF6B5B',
};

export default function AnalyticsPage() {
  const liveMetrics = useSocketStore((s) => s.systemMetrics);
  const { data: polled } = useSystemMetrics();
  const metrics = liveMetrics ?? polled;

  const distribution = metrics
    ? [
        { name: 'Completed', value: metrics.completedCount },
        { name: 'Failed', value: metrics.failedCount },
        { name: 'Running', value: metrics.runningCount },
        { name: 'Queued', value: metrics.queuedCount },
        { name: 'Retrying', value: metrics.retryingCount },
        { name: 'Pending', value: metrics.pendingCount },
        { name: 'Cancelled', value: metrics.cancelledCount },
        { name: 'Dead lettered', value: metrics.deadLetteredCount },
      ].filter((d) => d.value > 0)
    : [];

  const rateBars = metrics
    ? [
        { name: 'Success', rate: metrics.successRate },
        { name: 'Failure', rate: metrics.failureRate },
      ]
    : [];

  return (
    <>
      <Header title="Analytics" />
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Task Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {distribution.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">No task data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={distribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {distribution.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#8B92A8'} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#141925', border: '1px solid #2D3548', borderRadius: 6 }}
                      labelStyle={{ color: '#E8EAF0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                {distribution.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[d.name] ?? '#8B92A8' }}
                    />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Total Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <CardValue>{metrics?.totalTasks ?? '—'}</CardValue>
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
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Success vs Failure Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rateBars} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3548" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="#5C6480" fontSize={12} unit="%" />
                <YAxis type="category" dataKey="name" stroke="#5C6480" fontSize={12} width={70} />
                <Tooltip
                  contentStyle={{ background: '#141925', border: '1px solid #2D3548', borderRadius: 6 }}
                  labelStyle={{ color: '#E8EAF0' }}
                  formatter={(value: number) => [`${value}%`, 'Rate']}
                />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                  {rateBars.map((entry) => (
                    <Cell key={entry.name} fill={entry.name === 'Success' ? '#00D9A3' : '#FF6B5B'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
