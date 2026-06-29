import { Controller, Get, Header } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { GetSystemMetricsQuery } from './queries/get-system-metrics.query';
import { GetQueueMetricsQuery } from './queries/get-queue-metrics.query';
import { PrometheusMetricsService } from './prometheus-metrics.service';

@ApiTags('monitoring')
@ApiBearerAuth()
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly prometheusMetrics: PrometheusMetricsService,
  ) {}

  @Get('system')
  @ApiOperation({ summary: 'Aggregate system metrics: status counts, success/failure rate, throughput' })
  getSystemMetrics() {
    return this.queryBus.execute(new GetSystemMetricsQuery());
  }

  @Get('queues')
  @ApiOperation({ summary: 'Live RabbitMQ queue depth per priority queue, plus DLQ depth' })
  getQueueMetrics() {
    return this.queryBus.execute(new GetQueueMetricsQuery());
  }

  @Public()
  @SkipTransform()
  @Get('prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiExcludeEndpoint()
  async getPrometheusMetrics() {
    return this.prometheusMetrics.getMetricsText();
  }
}
