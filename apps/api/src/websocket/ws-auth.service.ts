import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { JwtPayload } from '../auth/jwt-payload.interface';

/**
 * Socket.IO doesn't go through NestJS's HTTP Guard pipeline, so JWT
 * verification for WebSocket connections is handled explicitly here and
 * invoked from the gateway's handleConnection lifecycle hook instead.
 */
@Injectable()
export class WsAuthService {
  private readonly logger = new Logger(WsAuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async authenticate(socket: Socket): Promise<JwtPayload | null> {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization?.toString().replace('Bearer ', ''));

    if (!token) {
      this.logger.warn(`WS connection ${socket.id} rejected: no token provided`);
      return null;
    }

    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch {
      this.logger.warn(`WS connection ${socket.id} rejected: invalid token`);
      return null;
    }
  }
}
