import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegisterWorkerDto, WorkerHeartbeatDto } from '@distrotask/shared';
import { Public } from '../common/decorators/roles.decorator';
import { WorkerServiceGuard } from '../common/guards/worker-service.guard';
import { RegisterWorkerCommand } from './commands/register-worker.command';
import { RecordHeartbeatCommand } from './commands/record-heartbeat.command';
import { ListWorkersQuery, GetWorkerByIdQuery } from './queries/list-workers.query';
import { GetWorkerMetricsQuery, GetActiveWorkerCountQuery } from './queries/worker-metrics.query';

@ApiTags('workers')
@ApiBearerAuth()
@Controller('workers')
export class WorkersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all registered workers' })
  list(@Query('status') status?: string) {
    return this.queryBus.execute(new ListWorkersQuery(status));
  }

  @Get('active-count')
  @ApiOperation({ summary: 'Get active vs total worker count' })
  activeCount() {
    return this.queryBus.execute(new GetActiveWorkerCountQuery());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single worker by id' })
  getById(@Param('id') id: string) {
    return this.queryBus.execute(new GetWorkerByIdQuery(id));
  }

  @Get(':id/metrics')
  @ApiOperation({ summary: 'Get recent metric snapshots for a worker' })
  getMetrics(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.queryBus.execute(new GetWorkerMetricsQuery(id, limit ? parseInt(limit, 10) : undefined));
  }

  // ── Internal worker-service callback routes ──────────────────────────

  @Public()
  @UseGuards(WorkerServiceGuard)
  @Post('register')
  @ApiOperation({ summary: '[internal] Worker process registers itself on startup' })
  register(@Body() dto: RegisterWorkerDto) {
    return this.commandBus.execute(
      new RegisterWorkerCommand(dto.name, dto.hostname, dto.pid, dto.queues, dto.concurrency, dto.version),
    );
  }

  @Public()
  @UseGuards(WorkerServiceGuard)
  @Post(':id/heartbeat')
  @ApiOperation({ summary: '[internal] Worker process sends a periodic heartbeat' })
  heartbeat(@Param('id') id: string, @Body() dto: WorkerHeartbeatDto) {
    return this.commandBus.execute(
      new RecordHeartbeatCommand(id, dto.currentTaskCount, dto.cpuUsagePercent, dto.memoryUsageMb),
    );
  }
}
