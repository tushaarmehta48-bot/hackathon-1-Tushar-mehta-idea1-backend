import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';

describe('Reservations (e2e)', () => {
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

  it('POST /api/v1/reservations requires authentication', () => {
    return request(app.getHttpServer())
      .post('/api/v1/reservations')
      .send({
        date: '2026-02-06',
        shiftId: 'c1000000-0000-4000-8000-000000000011',
        slotStartsAt: '2026-02-06T12:00:00.000Z',
        tableId: 'b1000000-0000-4000-8000-000000000001',
        partySize: 4,
        acceptedTerms: true,
      })
      .expect(401);
  });

  it('GET /api/v1/reservations/mine requires authentication', () => {
    return request(app.getHttpServer()).get('/api/v1/reservations/mine').expect(401);
  });
});
