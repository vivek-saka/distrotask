import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@distrotask/shared';

export const ROLES_KEY = 'roles';
/** Usage: `@Roles(UserRole.ADMIN, UserRole.OPERATOR)` above a controller method. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as not requiring JWT authentication (e.g. login, register, health check). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
