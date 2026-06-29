import { useQuery } from '@tanstack/react-query';
import { WorkerDto, WorkerMetricDto, SystemMetricsSnapshot, QueueMetricsSnapshot } from '@distrotask/shared';
import { apiClient } from '@/services/api-client';

interface ApiEnvelope<T> {
  success: true;
  data: T;
  timestamp: string;
}

export function useWorkers(status?: string) {
  return useQuery({
    queryKey: ['workers', status],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<WorkerDto[]>>('/v1/workers', {
        params: status ? { status } : undefined,
      });
      return data.data;
    },
    refetchInterval: 10_000,
  });
}

export function useWorker(workerId: string | null) {
  return useQuery({
    queryKey: ['worker', workerId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<WorkerDto>>(`/v1/workers/${workerId}`);
      return data.data;
    },
    enabled: !!workerId,
  });
}

export function useWorkerMetrics(workerId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['worker-metrics', workerId, limit],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<WorkerMetricDto[]>>(`/v1/workers/${workerId}/metrics`, {
        params: { limit },
      });
      return data.data;
    },
    enabled: !!workerId,
    refetchInterval: 10_000,
  });
}

export function useActiveWorkerCount() {
  return useQuery({
    queryKey: ['workers-active-count'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<{ active: number; total: number }>>(
        '/v1/workers/active-count',
      );
      return data.data;
    },
    refetchInterval: 10_000,
  });
}

export function useSystemMetrics() {
  return useQuery({
    queryKey: ['system-metrics'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<SystemMetricsSnapshot>>('/v1/monitoring/system');
      return data.data;
    },
    refetchInterval: 10_000,
  });
}

export function useQueueMetrics() {
  return useQuery({
    queryKey: ['queue-metrics'],
    queryFn: async () => {
      const { data } = await apiClient.get<
        ApiEnvelope<{ queues: QueueMetricsSnapshot[]; deadLetterDepth: number }>
      >('/v1/monitoring/queues');
      return data.data;
    },
    refetchInterval: 10_000,
  });
}
