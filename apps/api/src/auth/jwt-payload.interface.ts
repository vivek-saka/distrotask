import { UserRole } from '@distrotask/shared';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string;
  jti: string; // unique token id, used for revocation tracking
  iat?: number;
  exp?: number;
}
