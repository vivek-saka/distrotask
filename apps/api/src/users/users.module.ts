import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UsersController } from './users.controller';
import { ListUsersHandler } from './queries/list-users.query';
import { UpdateUserRoleHandler } from './commands/update-user-role.command';

@Module({
  imports: [CqrsModule],
  controllers: [UsersController],
  providers: [ListUsersHandler, UpdateUserRoleHandler],
})
export class UsersModule {}
