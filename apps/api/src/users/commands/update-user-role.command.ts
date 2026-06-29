import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { UserRole, UserDto, omitUndefined } from '@distrotask/shared';
import { PrismaService } from '../../config/prisma.service';

export class UpdateUserRoleCommand {
  constructor(
    public readonly userId: string,
    public readonly role?: UserRole,
    public readonly isActive?: boolean,
  ) {}
}

@CommandHandler(UpdateUserRoleCommand)
export class UpdateUserRoleHandler implements ICommandHandler<UpdateUserRoleCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdateUserRoleCommand): Promise<UserDto> {
    const existing = await this.prisma.user.findUnique({ where: { id: command.userId } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const data = omitUndefined({ role: command.role, isActive: command.isActive });

    const user = await this.prisma.user.update({
      where: { id: command.userId },
      data,
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserDto['role'],
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
