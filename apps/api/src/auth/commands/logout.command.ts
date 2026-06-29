import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../config/prisma.service';

export class LogoutCommand {
  constructor(public readonly userId: string) {}
}

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: LogoutCommand): Promise<{ success: boolean }> {
    await this.prisma.user.update({
      where: { id: command.userId },
      data: { refreshTokenHash: null },
    });
    return { success: true };
  }
}
