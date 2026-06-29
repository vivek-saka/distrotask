import { Injectable, Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsGateway } from '../websocket/events.gateway';
import { GetSystemMetricsQuery } from './queries/get-system-metrics.query';
import { GetQueueMetricsQuery } from './queries/get-queue-metrics.query';
import { PrometheusMetricsService } from './prometheus-metrics.service';

@Injectable()
export class MetricsBroadcaster {
  private readonly logger = new Logger(MetricsBroadcaster.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly gateway: EventsGateway,
    private readonly prometheusMetrics: PrometheusMetricsService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async broadcastSystemMetrics() {
    try {
      const metrics = await this.queryBus.execute(new GetSystemMetricsQuery());
      this.gateway.emitSystemMetrics(metrics);
      this.prometheusMetrics.activeWorkersGauge.set(metrics.activeWorkerCount);
    } catch (err) {
      this.logger.warn(`Failed to broadcast system metrics: ${(err as Error).message}`);
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async broadcastQueueMetrics() {
    try {
      const { queues } = await this.queryBus.execute(new GetQueueMetricsQuery());
      this.gateway.emitQueueMetrics({ queues });
      for (const q of queues) {
        this.prometheusMetrics.queueDepthGauge.set({ queue: q.queueName }, q.depth);
      }
    } catch (err) {
      // RabbitMQ may be briefly unreachable during a reconnect — don't let
      // this scheduled task crash the process, just skip this tick.
      this.logger.warn(`Failed to broadcast queue metrics: ${(err as Error).message}`);
    }
  }
}
