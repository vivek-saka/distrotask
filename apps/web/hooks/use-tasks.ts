import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CreateTaskDto, UpdateTaskDto, TaskDto, TaskLogDto, PaginatedResult } from '@distrotask/shared';
import { apiClient } from '@/services/api-client';

interface TaskFilters {
  status?: string;
  priority?: string;
  queueName?: string;
  type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface ApiEnvelope<T> {
  success: true;
  data: T;
  timestamp: string;
}

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<PaginatedResult<TaskDto>>>('/v1/tasks', {
        params: filters,
      });
      return data.data;
    },
    refetchInterval: 10_000, // belt-and-suspenders polling alongside WS invalidation
  });
}

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TaskDto>>(`/v1/tasks/${taskId}`);
      return data.data;
    },
    enabled: !!taskId,
  });
}

export function useTaskLogs(taskId: string | null) {
  return useQuery({
    queryKey: ['task-logs', taskId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TaskLogDto[]>>(`/v1/tasks/${taskId}/logs`);
      return data.data;
    },
    enabled: !!taskId,
    refetchInterval: 3_000,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateTaskDto) => {
      const { data } = await apiClient.post<ApiEnvelope<TaskDto>>('/v1/tasks', dto);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to create task');
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateTaskDto }) => {
      const { data } = await apiClient.patch<ApiEnvelope<TaskDto>>(`/v1/tasks/${id}`, dto);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to update task'),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/v1/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to delete task'),
  });
}

export function useCancelTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiEnvelope<TaskDto>>(`/v1/tasks/${id}/cancel`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task cancelled');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to cancel task'),
  });
}

export function useRetryTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiEnvelope<TaskDto>>(`/v1/tasks/${id}/retry`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task re-queued');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to retry task'),
  });
}
