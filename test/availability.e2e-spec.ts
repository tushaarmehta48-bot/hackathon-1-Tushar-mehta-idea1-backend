import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';

describe('Availability (e2e)', () => {
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

  it('GET /api/v1/availability is public and validates query', () => {
    return request(app.getHttpServer()).get('/api/v1/availability').expect(400);
  });

  it('GET /api/v1/floor-plan is public and validates query', () => {
    return request(app.getHttpServer()).get('/api/v1/floor-plan').expect(400);
  });
});
