import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../config/prisma.service';
import { AuthTokensResult, AuthService } from '../auth.service';

export class RegisterCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly firstName: string,
    public readonly lastName: string,
  ) {}
}

const BCRYPT_SALT_ROUNDS = 12;

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  private readonly logger = new Logger(RegisterHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async execute(command: RegisterCommand): Promise<AuthTokensResult> {
    const { email, password, firstName, lastName } = command;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // First registered user becomes ADMIN; everyone after defaults to VIEWER
    // and must be promoted by an existing admin. Keeps the system bootstrap-able
    // without a manual DB seed in a fresh environment.
    const userCount = await this.prisma.user.count();
    const role = userCount === 0 ? 'ADMIN' : 'VIEWER';

    const user = await this.prisma.user.create({
      data: { email, passwordHash, firstName, lastName, role },
    });

    this.logger.log(`New user registered: ${user.email} (role=${user.role})`);

    return this.authService.issueTokens(user.id, user.email, user.role);
  }
}
