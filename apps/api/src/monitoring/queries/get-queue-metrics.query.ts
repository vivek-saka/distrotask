import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { QueueInspector } from '@distrotask/rabbitmq';
import { QueueMetricsSnapshot } from '@distrotask/shared';
import { QUEUE_INSPECTOR } from '../../queue/queue.module';

export class GetQueueMetricsQuery {}

@QueryHandler(GetQueueMetricsQuery)
export class GetQueueMetricsHandler implements IQueryHandler<GetQueueMetricsQuery> {
  constructor(@Inject(QUEUE_INSPECTOR) private readonly queueInspector: QueueInspector) {}

  async execute(): Promise<{ queues: QueueMetricsSnapshot[]; deadLetterDepth: number }> {
    const [queues, deadLetterDepth] = await Promise.all([
      this.queueInspector.getAllPriorityQueueMetrics(),
      this.queueInspector.getDeadLetterQueueDepth(),
    ]);

    return { queues, deadLetterDepth };
  }
}
