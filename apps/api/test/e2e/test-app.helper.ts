import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { PrismaService } from '../../src/config/prisma.service';

export interface TestAppContext {
  app: INestApplication;
  prisma: PrismaService;
  moduleRef: TestingModule;
}

/**
 * Boots the real AppModule (not a trimmed-down test double) and applies the
 * exact same global pipes/filters/prefix/versioning as production main.ts.
 * This is deliberate: an e2e suite that diverges from the real bootstrap
 * config tests a different app than the one that actually ships.
 */
export async function createTestApp(): Promise<TestAppContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  await app.init();

  const prisma = app.get(PrismaService);

  return { app, prisma, moduleRef };
}

export async function closeTestApp(ctx: TestAppContext): Promise<void> {
  await ctx.app.close();
}

/**
 * Generates a unique-enough email per test run so parallel/repeated test
 * executions never collide on the User.email unique constraint.
 */
export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.distrotask.local`;
}
