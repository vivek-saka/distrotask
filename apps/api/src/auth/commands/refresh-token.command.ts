import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { AuthTokensResult, AuthService } from '../auth.service';
import { JwtRefreshPayload } from '../jwt-payload.interface';

export class RefreshTokenCommand {
  constructor(public readonly refreshToken: string) {}
}

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler implements ICommandHandler<RefreshTokenCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<AuthTokensResult> {
    let payload: JwtRefreshPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(command.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    // The refresh token is stored hashed, never raw — same principle as a password.
    // This means a stolen DB dump doesn't hand out usable refresh tokens.
    const tokenMatches = await bcrypt.compare(command.refreshToken, user.refreshTokenHash);
    if (!tokenMatches) {
      // Possible token reuse/theft: a previously-rotated-out token was presented.
      // Defensively revoke the stored token so the legitimate session is forced to re-login.
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
      throw new UnauthorizedException('Refresh token reuse detected; please log in again');
    }

    // Rotation: every refresh issues a brand new refresh token and invalidates the old one.
    return this.authService.issueTokens(user.id, user.email, user.role);
  }
}
