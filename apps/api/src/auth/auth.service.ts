import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@distrotask/shared';
import { PrismaService } from '../config/prisma.service';
import { JwtPayload, JwtRefreshPayload } from './jwt-payload.interface';

export interface AuthTokensResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
}

const REFRESH_TOKEN_BCRYPT_ROUNDS = 10;

/**
 * Centralizes JWT issuance so every command handler (Register, Login, Refresh)
 * produces tokens the exact same way. Kept separate from the handlers
 * themselves to avoid duplicating crypto-sensitive logic in three places.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issueTokens(userId: string, email: string, role: UserRole | string): Promise<AuthTokensResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const accessPayload: JwtPayload = { sub: userId, email, role: role as UserRole };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.expiresIn'),
    });

    const refreshPayload: JwtRefreshPayload = { sub: userId, jti: uuidv4() };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
    });

    // Store only the hash so a DB leak doesn't expose usable refresh tokens.
    const refreshTokenHash = await bcrypt.hash(refreshToken, REFRESH_TOKEN_BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('jwt.expiresIn')!,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as UserRole,
      },
    };
  }
}
