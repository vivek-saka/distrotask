import { IsString, IsNotEmpty, IsArray, IsInt, Min, IsOptional } from 'class-validator';

export class RegisterWorkerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  hostname!: string;

  @IsInt()
  pid!: number;

  @IsArray()
  @IsString({ each: true })
  queues!: string[];

  @IsInt()
  @Min(1)
  concurrency!: number;

  @IsOptional()
  @IsString()
  version?: string;
}

export class WorkerHeartbeatDto {
  @IsInt()
  @Min(0)
  currentTaskCount!: number;

  @IsOptional()
  cpuUsagePercent?: number;

  @IsOptional()
  memoryUsageMb?: number;
}
