import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { uniqueEmail } from './test-app.helper';

export interface AuthenticatedTestUser {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
}

export async function registerAndLogin(
  app: INestApplication,
  prefix = 'user',
): Promise<AuthenticatedTestUser> {
  const email = uniqueEmail(prefix);

  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email, password: 'StrongPass1', firstName: 'Test', lastName: 'User' })
    .expect(201);

  const { accessToken, refreshToken, user } = res.body.data;
  return { accessToken, refreshToken, userId: user.id, email };
}

export function authHeader(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}
