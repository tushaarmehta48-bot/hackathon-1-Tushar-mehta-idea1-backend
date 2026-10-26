import { INestApplication, ValidationPipe } from '@nestjs/common';

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value?.trim()) {
    return ['http://localhost:3000'];
  }
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Shared HTTP settings for main and tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
