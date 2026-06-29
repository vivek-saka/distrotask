import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsEvent, WsRoom } from '@distrotask/shared';
import { WsAuthService } from './ws-auth.service';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN ?? '*', credentials: true },
  namespace: '/ws',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly wsAuthService: WsAuthService) {}

  async handleConnection(client: Socket) {
    const payload = await this.wsAuthService.authenticate(client);

    if (!payload) {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
      return;
    }

    client.data.userId = payload.sub;
    client.data.role = payload.role;

    // All connected clients implicitly join the metrics room — system-wide
    // metrics are low-cardinality and cheap to broadcast to everyone.
    await client.join(WsRoom.METRICS);

    client.emit(WsEvent.CONNECTED, { userId: payload.sub, connectedAt: new Date().toISOString() });
    this.logger.log(`Client connected: ${client.id} (user=${payload.sub})`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(WsEvent.SUBSCRIBE)
  async handleSubscribe(@ConnectedSocket() client: Socket, @MessageBody() room: WsRoom) {
    if (!Object.values(WsRoom).includes(room)) {
      return { error: `Unknown room: ${room}` };
    }
    await client.join(room);
    return { subscribed: room };
  }

  @SubscribeMessage(WsEvent.UNSUBSCRIBE)
  async handleUnsubscribe(@ConnectedSocket() client: Socket, @MessageBody() room: WsRoom) {
    await client.leave(room);
    return { unsubscribed: room };
  }

  // ── Emit helpers, called by the CQRS event handlers in ./handlers ────

  emitTaskCreated(payload: unknown) {
    this.server.to(WsRoom.TASKS).emit(WsEvent.TASK_CREATED, payload);
  }

  emitTaskUpdated(payload: unknown) {
    this.server.to(WsRoom.TASKS).emit(WsEvent.TASK_UPDATED, payload);
  }

  emitTaskStatusChanged(payload: unknown) {
    this.server.to(WsRoom.TASKS).emit(WsEvent.TASK_STATUS_CHANGED, payload);
  }

  emitTaskDeleted(payload: unknown) {
    this.server.to(WsRoom.TASKS).emit(WsEvent.TASK_DELETED, payload);
  }

  emitWorkerRegistered(payload: unknown) {
    this.server.to(WsRoom.WORKERS).emit(WsEvent.WORKER_REGISTERED, payload);
  }

  emitWorkerHeartbeat(payload: unknown) {
    this.server.to(WsRoom.WORKERS).emit(WsEvent.WORKER_HEARTBEAT, payload);
  }

  emitWorkerStatusChanged(payload: unknown) {
    this.server.to(WsRoom.WORKERS).emit(WsEvent.WORKER_STATUS_CHANGED, payload);
  }

  emitWorkerOffline(payload: unknown) {
    this.server.to(WsRoom.WORKERS).emit(WsEvent.WORKER_OFFLINE, payload);
  }

  emitSystemMetrics(payload: unknown) {
    this.server.to(WsRoom.METRICS).emit(WsEvent.METRICS_SYSTEM, payload);
  }

  emitQueueMetrics(payload: unknown) {
    this.server.to(WsRoom.METRICS).emit(WsEvent.METRICS_QUEUE, payload);
  }
}
