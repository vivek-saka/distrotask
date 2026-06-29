import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { appConfig, databaseConfig, redisConfig, rabbitmqConfig, jwtConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './config/prisma.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { QueueModule } from './queue/queue.module';
import { TasksModule } from './tasks/tasks.module';
import { WorkersModule } from './workers/workers.module';
import { WebsocketModule } from './websocket/websocket.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [appConfig, databaseConfig, redisConfig, rabbitmqConfig, jwtConfig],
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }], // global default; per-route overrides via @Throttle
    }),
    CqrsModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    QueueModule,
    AuthModule,
    UsersModule,
    TasksModule,
    WorkersModule,
    WebsocketModule,
    MonitoringModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // global auth: every route protected unless @Public()
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
