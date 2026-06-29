import { Module } from '@nestjs/common';
import { CqrsModule, CommandBus } from '@nestjs/cqrs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { WorkersController } from './workers.controller';
import { RegisterWorkerHandler } from './commands/register-worker.command';
import { RecordHeartbeatHandler } from './commands/record-heartbeat.command';
import { DetectStaleWorkersHandler, DetectStaleWorkersCommand } from './commands/detect-stale-workers.command';
import { ListWorkersHandler, GetWorkerByIdHandler } from './queries/list-workers.query';
import { GetWorkerMetricsHandler, GetActiveWorkerCountHandler } from './queries/worker-metrics.query';

const CommandHandlers = [RegisterWorkerHandler, RecordHeartbeatHandler, DetectStaleWorkersHandler];
const QueryHandlers = [ListWorkersHandler, GetWorkerByIdHandler, GetWorkerMetricsHandler, GetActiveWorkerCountHandler];

/**
 * Periodically sweeps for workers that have stopped sending heartbeats and
 * marks them OFFLINE. Runs as a scheduled NestJS task rather than a
 * worker-initiated mechanism, since a worker that has actually crashed is,
 * by definition, not around to report its own death.
 *
 * Relies on ScheduleModule.forRoot() being registered once globally in
 * AppModule — NestJS's scheduler is process-wide, so forRoot() must not be
 * called again here.
 */
@Injectable()
class WorkerHealthScheduler {
  constructor(private readonly commandBus: CommandBus) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sweepStaleWorkers() {
    await this.commandBus.execute(new DetectStaleWorkersCommand());
  }
}

@Module({
  imports: [CqrsModule],
  controllers: [WorkersController],
  providers: [...CommandHandlers, ...QueryHandlers, WorkerHealthScheduler],
})
export class WorkersModule {}
