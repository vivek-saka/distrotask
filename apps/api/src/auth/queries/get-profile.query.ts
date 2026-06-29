import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { UserDto } from '@distrotask/shared';

export class GetProfileQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(GetProfileQuery)
export class GetProfileHandler implements IQueryHandler<GetProfileQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetProfileQuery): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: query.userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

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
