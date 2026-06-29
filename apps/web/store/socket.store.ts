import { create } from 'zustand';
import { SystemMetricsSnapshot, QueueMetricsSnapshot } from '@distrotask/shared';

interface SocketState {
  connected: boolean;
  systemMetrics: SystemMetricsSnapshot | null;
  queueMetrics: QueueMetricsSnapshot[];
  setConnected: (connected: boolean) => void;
  setSystemMetrics: (metrics: SystemMetricsSnapshot) => void;
  setQueueMetrics: (queues: QueueMetricsSnapshot[]) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  connected: false,
  systemMetrics: null,
  queueMetrics: [],
  setConnected: (connected) => set({ connected }),
  setSystemMetrics: (systemMetrics) => set({ systemMetrics }),
  setQueueMetrics: (queueMetrics) => set({ queueMetrics }),
}));
