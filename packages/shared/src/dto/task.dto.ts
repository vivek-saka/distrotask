import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { TaskPriority } from '../types/enums';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  /** Logical executor type, e.g. "email.send" — must match a registered worker executor. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsString()
  @IsOptional()
  queueName?: string;

  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  maxRetries?: number;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  maxRetries?: number;
}

export class TaskQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  queueName?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  search?: string;
}
