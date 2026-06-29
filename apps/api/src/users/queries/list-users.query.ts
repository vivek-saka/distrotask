import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../config/prisma.service';
import { UserDto } from '@distrotask/shared';

export class ListUsersQuery {}

@QueryHandler(ListUsersQuery)
export class ListUsersHandler implements IQueryHandler<ListUsersQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role as UserDto['role'],
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    }));
  }
}
