import { ApiProperty } from '@nestjs/swagger';
import { TaskDto } from '@distrotask/shared';

export { CreateTaskDto, UpdateTaskDto, TaskQueryDto } from '@distrotask/shared';

/**
 * Swagger response shape for a single Task. Mirrors TaskDto from the shared
 * package field-for-field; kept separate so @ApiProperty decorators (used
 * only for OpenAPI generation) don't leak into the shared package, which is
 * also consumed by the framework-agnostic worker process.
 */
export class TaskResponseDto implements TaskDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() type!: string;
  @ApiProperty() payload!: Record<string, unknown>;
  @ApiProperty({ nullable: true }) result!: Record<string, unknown> | null;
  @ApiProperty() status!: TaskDto['status'];
  @ApiProperty() priority!: TaskDto['priority'];
  @ApiProperty() queueName!: string;
  @ApiProperty() maxRetries!: number;
  @ApiProperty() retryCount!: number;
  @ApiProperty() backoffStrategy!: string;
  @ApiProperty({ nullable: true }) nextRetryAt!: string | null;
  @ApiProperty({ nullable: true }) errorMessage!: string | null;
  @ApiProperty() createdById!: string;
  @ApiProperty({ nullable: true }) workerId!: string | null;
  @ApiProperty({ nullable: true }) scheduleId!: string | null;
  @ApiProperty({ nullable: true }) queuedAt!: string | null;
  @ApiProperty({ nullable: true }) startedAt!: string | null;
  @ApiProperty({ nullable: true }) completedAt!: string | null;
  @ApiProperty({ nullable: true }) durationMs!: number | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
