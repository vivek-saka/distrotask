import { Global, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQConnectionManager, TaskProducer, QueueInspector } from '@distrotask/rabbitmq';

export const TASK_PRODUCER = 'TASK_PRODUCER';
export const QUEUE_INSPECTOR = 'QUEUE_INSPECTOR';

/**
 * NestJS-lifecycle-aware wrapper around RabbitMQConnectionManager so the
 * AMQP connection is opened in onModuleInit and closed gracefully in
 * onModuleDestroy (fired when app.enableShutdownHooks() catches SIGTERM).
 */
@Injectable()
export class RabbitMQConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQConnectionService.name);
  public manager!: RabbitMQConnectionManager;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.manager = new RabbitMQConnectionManager({
      url: this.configService.get<string>('rabbitmq.url')!,
      logger: {
        log: (m) => this.logger.log(m),
        error: (m, t) => this.logger.error(m, t),
        warn: (m) => this.logger.warn(m),
      },
    });
    await this.manager.connect();
  }

  async onModuleDestroy() {
    await this.manager.close();
    this.logger.log('RabbitMQ connection closed gracefully');
  }
}

/**
 * Global module so TaskProducer/QueueInspector can be injected anywhere
 * (Tasks module for publishing, Monitoring module for queue depth) without
 * every feature module re-importing RabbitMQ wiring.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RabbitMQConnectionService,
    {
      provide: TASK_PRODUCER,
      inject: [RabbitMQConnectionService],
      useFactory: (svc: RabbitMQConnectionService) => new TaskProducer(svc.manager),
    },
    {
      provide: QUEUE_INSPECTOR,
      inject: [RabbitMQConnectionService],
      useFactory: (svc: RabbitMQConnectionService) => new QueueInspector(svc.manager),
    },
  ],
  exports: [RabbitMQConnectionService, TASK_PRODUCER, QUEUE_INSPECTOR],
})
export class QueueModule {}
