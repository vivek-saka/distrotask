import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventsGateway } from './events.gateway';
import { WsAuthService } from './ws-auth.service';
import {
  TaskCreatedWsHandler,
  TaskUpdatedWsHandler,
  TaskStatusChangedWsHandler,
  TaskDeletedWsHandler,
} from './handlers/task-events.ws-handler';
import {
  WorkerRegisteredWsHandler,
  WorkerHeartbeatWsHandler,
  WorkerStatusChangedWsHandler,
  WorkerOfflineWsHandler,
} from './handlers/worker-events.ws-handler';

const WsEventHandlers = [
  TaskCreatedWsHandler,
  TaskUpdatedWsHandler,
  TaskStatusChangedWsHandler,
  TaskDeletedWsHandler,
  WorkerRegisteredWsHandler,
  WorkerHeartbeatWsHandler,
  WorkerStatusChangedWsHandler,
  WorkerOfflineWsHandler,
];

@Module({
  imports: [
    CqrsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
      }),
    }),
  ],
  providers: [EventsGateway, WsAuthService, ...WsEventHandlers],
  exports: [EventsGateway],
})
export class WebsocketModule {}
