'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import {
  WsEvent,
  WsRoom,
  WsTaskStatusChangedPayload,
  WsMetricsQueuePayload,
  SystemMetricsSnapshot,
} from '@distrotask/shared';
import { useAuthStore } from '@/store/auth.store';
import { useSocketStore } from '@/store/socket.store';

let socketSingleton: Socket | null = null;

export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setConnected = useSocketStore((s) => s.setConnected);
  const setSystemMetrics = useSocketStore((s) => s.setSystemMetrics);
  const setQueueMetrics = useSocketStore((s) => s.setQueueMetrics);
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001/ws';
    const socket = socketSingleton ?? io(wsUrl, { auth: { token: accessToken }, transports: ['websocket'] });
    socketSingleton = socket;
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on(WsEvent.CONNECTED, () => {
      socket.emit(WsEvent.SUBSCRIBE, WsRoom.TASKS);
      socket.emit(WsEvent.SUBSCRIBE, WsRoom.WORKERS);
    });

    // Task events invalidate the relevant React Query caches so the Tasks
    // page re-fetches rather than tracking a fully separate live data model.
    const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: ['tasks'] });
    socket.on(WsEvent.TASK_CREATED, invalidateTasks);
    socket.on(WsEvent.TASK_UPDATED, invalidateTasks);
    socket.on(WsEvent.TASK_STATUS_CHANGED, (payload: WsTaskStatusChangedPayload) => {
      invalidateTasks();
      queryClient.invalidateQueries({ queryKey: ['task', payload.task.id] });
    });
    socket.on(WsEvent.TASK_DELETED, invalidateTasks);

    const invalidateWorkers = () => queryClient.invalidateQueries({ queryKey: ['workers'] });
    socket.on(WsEvent.WORKER_REGISTERED, invalidateWorkers);
    socket.on(WsEvent.WORKER_HEARTBEAT, invalidateWorkers);
    socket.on(WsEvent.WORKER_STATUS_CHANGED, invalidateWorkers);
    socket.on(WsEvent.WORKER_OFFLINE, invalidateWorkers);

    socket.on(WsEvent.METRICS_SYSTEM, (payload: SystemMetricsSnapshot) => setSystemMetrics(payload));
    socket.on(WsEvent.METRICS_QUEUE, (payload: WsMetricsQueuePayload) => setQueueMetrics(payload.queues));

    return () => {
      // Intentionally not disconnecting the singleton on unmount — multiple
      // pages mount/unmount this hook during navigation, and tearing the
      // socket down each time would cause a reconnect storm. The socket is
      // torn down on logout instead (see disconnectSocket, called from the
      // logout action).
    };
  }, [accessToken, queryClient, setConnected, setSystemMetrics, setQueueMetrics]);

  return socketRef.current;
}

export function disconnectSocket() {
  socketSingleton?.disconnect();
  socketSingleton = null;
}
