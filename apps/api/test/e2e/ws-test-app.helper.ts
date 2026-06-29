import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';

export interface WsTestAppContext {
  app: INestApplication;
  url: string;
  wsUrl: string;
}

/**
 * Unlike the Supertest-based HTTP e2e tests (which talk to the Nest app
 * in-memory), a real Socket.IO client needs an actual TCP listener to
 * connect to. This helper boots the same AppModule but calls app.listen()
 * on an OS-assigned ephemeral port (0) so parallel test runs never collide.
 */
export async function createWsTestApp(): Promise<WsTestAppContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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

  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const url = `http://127.0.0.1:${port}`;

  return { app, url, wsUrl: `${url}/ws` };
}

export async function closeWsTestApp(ctx: WsTestAppContext): Promise<void> {
  await ctx.app.close();
}
