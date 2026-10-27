import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';

describe('Staff operations (e2e)', () => {
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

  it('GET /api/v1/staff/reservations requires authentication', () => {
    return request(app.getHttpServer())
      .get('/api/v1/staff/reservations?date=2026-02-06')
      .expect(401);
  });

  it('POST /api/v1/check-in/scan requires authentication', () => {
    return request(app.getHttpServer())
      .post('/api/v1/check-in/scan')
      .send({ reference: 'HS-TEST01' })
      .expect(401);
  });
});
