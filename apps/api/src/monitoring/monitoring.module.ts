import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { WebsocketModule } from '../websocket/websocket.module';
import { MonitoringController } from './monitoring.controller';
import { PrometheusMetricsService } from './prometheus-metrics.service';
import { MetricsBroadcaster } from './metrics-broadcaster.service';
import { GetSystemMetricsHandler } from './queries/get-system-metrics.query';
import { GetQueueMetricsHandler } from './queries/get-queue-metrics.query';

@Module({
  imports: [CqrsModule, WebsocketModule],
  controllers: [MonitoringController],
  providers: [
    PrometheusMetricsService,
    MetricsBroadcaster,
    GetSystemMetricsHandler,
    GetQueueMetricsHandler,
  ],
  exports: [PrometheusMetricsService],
})
export class MonitoringModule {}
