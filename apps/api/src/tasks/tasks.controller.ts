import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { CreateTaskDto, UpdateTaskDto, TaskQueryDto, TaskStatus, TaskLogLevel } from '@distrotask/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/roles.decorator';
import { WorkerServiceGuard } from '../common/guards/worker-service.guard';
import { CreateTaskCommand } from './commands/create-task.command';
import { UpdateTaskCommand } from './commands/update-task.command';
import { DeleteTaskCommand } from './commands/delete-task.command';
import { CancelTaskCommand } from './commands/cancel-task.command';
import { RetryTaskCommand } from './commands/retry-task.command';
import { UpdateTaskStatusCommand } from './commands/update-task-status.command';
import { AppendTaskLogCommand } from './commands/append-task-log.command';
import { GetTaskByIdQuery } from './queries/get-task-by-id.query';
import { ListTasksQuery } from './queries/list-tasks.query';
import { GetTaskLogsQuery } from './queries/get-task-logs.query';

class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @IsString()
  @IsOptional()
  workerId?: string;

  @IsObject()
  @IsOptional()
  result?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  errorMessage?: string;

  @IsString()
  @IsOptional()
  errorStack?: string;

  @IsOptional()
  durationMs?: number;
}

class AppendTaskLogDto {
  @IsEnum(TaskLogLevel)
  level!: TaskLogLevel;

  @IsString()
  message!: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create and enqueue a new task' })
  create(@Body() dto: CreateTaskDto, @CurrentUser('userId') userId: string) {
    return this.commandBus.execute(
      new CreateTaskCommand(
        userId,
        dto.name,
        dto.type,
        dto.payload,
        dto.priority,
        dto.queueName,
        dto.maxRetries,
        dto.idempotencyKey,
      ),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List tasks with filters and pagination' })
  list(@Query() query: TaskQueryDto) {
    return this.queryBus.execute(
      new ListTasksQuery(
        query.status,
        query.priority,
        query.queueName,
        query.type,
        query.search,
        query.page,
        query.pageSize,
      ),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single task by id' })
  getById(@Param('id') id: string) {
    return this.queryBus.execute(new GetTaskByIdQuery(id));
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get the execution log lines for a task' })
  getLogs(@Param('id') id: string) {
    return this.queryBus.execute(new GetTaskLogsQuery(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a PENDING or QUEUED task' })
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.commandBus.execute(
      new UpdateTaskCommand(id, dto.name, dto.payload, dto.priority, dto.maxRetries),
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task in a terminal state' })
  delete(@Param('id') id: string) {
    return this.commandBus.execute(new DeleteTaskCommand(id));
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a task that has not yet completed' })
  cancel(@Param('id') id: string) {
    return this.commandBus.execute(new CancelTaskCommand(id));
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Manually retry a FAILED or DEAD_LETTERED task' })
  retry(@Param('id') id: string) {
    return this.commandBus.execute(new RetryTaskCommand(id));
  }

  // ── Internal worker-callback routes ──────────────────────────────────
  // Authenticated via shared-secret header (WorkerServiceGuard), not a user
  // JWT, since the caller here is the Worker microservice, not an end user.

  @Public()
  @UseGuards(WorkerServiceGuard)
  @Patch(':id/status')
  @ApiOperation({ summary: '[internal] Worker reports a task status transition' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTaskStatusDto) {
    return this.commandBus.execute(
      new UpdateTaskStatusCommand(id, dto.status, {
        workerId: dto.workerId,
        result: dto.result,
        errorMessage: dto.errorMessage,
        errorStack: dto.errorStack,
        durationMs: dto.durationMs,
      }),
    );
  }

  @Public()
  @UseGuards(WorkerServiceGuard)
  @Post(':id/logs')
  @ApiOperation({ summary: '[internal] Worker appends a log line during execution' })
  appendLog(@Param('id') id: string, @Body() dto: AppendTaskLogDto) {
    return this.commandBus.execute(new AppendTaskLogCommand(id, dto.level, dto.message, dto.metadata));
  }
}
