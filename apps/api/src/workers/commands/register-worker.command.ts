import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { WorkerStatus } from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';
import { toWorkerDto } from '../worker.mapper';
import { WorkerRegisteredEvent } from '../events/worker.events';

export class RegisterWorkerCommand {
  constructor(
    public readonly name: string,
    public readonly hostname: string,
    public readonly pid: number,
    public readonly queues: string[],
    public readonly concurrency: number,
    public readonly version?: string,
  ) {}
}

@CommandHandler(RegisterWorkerCommand)
export class RegisterWorkerHandler implements ICommandHandler<RegisterWorkerCommand> {
  private readonly logger = new Logger(RegisterWorkerHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RegisterWorkerCommand) {
    // Upsert by `name` (unique): a worker process that restarts (deploy,
    // crash-recovery) re-registers under the same logical name rather than
    // accumulating a new row every time, so historical metrics stay attached
    // to one continuous worker identity.
    const worker = await this.prisma.worker.upsert({
      where: { name: command.name },
      create: {
        name: command.name,
        hostname: command.hostname,
        pid: command.pid,
        queues: command.queues,
        concurrency: command.concurrency,
        version: command.version,
        status: WorkerStatus.ONLINE,
        lastHeartbeatAt: new Date(),
        startedAt: new Date(),
        stoppedAt: null,
      },
      update: {
        hostname: command.hostname,
        pid: command.pid,
        queues: command.queues,
        concurrency: command.concurrency,
        version: command.version,
        status: WorkerStatus.ONLINE,
        lastHeartbeatAt: new Date(),
        startedAt: new Date(),
        stoppedAt: null,
        currentTaskCount: 0,
      },
    });

    this.logger.log(`Worker registered: ${worker.name} (pid=${worker.pid}, queues=[${worker.queues.join(', ')}])`);

    const dto = toWorkerDto(worker);
    this.eventBus.publish(new WorkerRegisteredEvent(dto));
    return dto;
  }
}
