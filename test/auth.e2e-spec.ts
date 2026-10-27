import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/health is public', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('GET /api/v1/me requires auth', () => {
    return request(app.getHttpServer()).get('/api/v1/me').expect(401);
  });

  it('GET /api/v1/admin/session requires auth', () => {
    return request(app.getHttpServer()).get('/api/v1/admin/session').expect(401);
  });

  it('GET /api/v1/staff/session requires auth', () => {
    return request(app.getHttpServer()).get('/api/v1/staff/session').expect(401);
  });

  it('rejects malformed bearer token', () => {
    return request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('POST /api/v1/auth/portal/sign-in rejects wrong credentials', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/portal/sign-in')
      .send({ portal: 'staff', userId: 'wrong-id', password: 'wrong-password-123' })
      .expect(401);
  });
});
