import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TasksController } from './tasks.controller';
import { CreateTaskHandler } from './commands/create-task.command';
import { UpdateTaskHandler } from './commands/update-task.command';
import { DeleteTaskHandler } from './commands/delete-task.command';
import { CancelTaskHandler } from './commands/cancel-task.command';
import { RetryTaskHandler } from './commands/retry-task.command';
import { UpdateTaskStatusHandler } from './commands/update-task-status.command';
import { AppendTaskLogHandler } from './commands/append-task-log.command';
import { GetTaskByIdHandler } from './queries/get-task-by-id.query';
import { ListTasksHandler } from './queries/list-tasks.query';
import { GetTaskLogsHandler } from './queries/get-task-logs.query';

const CommandHandlers = [
  CreateTaskHandler,
  UpdateTaskHandler,
  DeleteTaskHandler,
  CancelTaskHandler,
  RetryTaskHandler,
  UpdateTaskStatusHandler,
  AppendTaskLogHandler,
];

const QueryHandlers = [GetTaskByIdHandler, ListTasksHandler, GetTaskLogsHandler];

@Module({
  imports: [CqrsModule],
  controllers: [TasksController],
  providers: [...CommandHandlers, ...QueryHandlers],
})
export class TasksModule {}
