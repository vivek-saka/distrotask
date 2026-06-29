import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RegisterHandler } from './commands/register.command';
import { LoginHandler } from './commands/login.command';
import { RefreshTokenHandler } from './commands/refresh-token.command';
import { LogoutHandler } from './commands/logout.command';
import { GetProfileHandler } from './queries/get-profile.query';

const CommandHandlers = [RegisterHandler, LoginHandler, RefreshTokenHandler, LogoutHandler];
const QueryHandlers = [GetProfileHandler];

@Module({
  imports: [
    CqrsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ...CommandHandlers, ...QueryHandlers],
  exports: [AuthService],
})
export class AuthModule {}
