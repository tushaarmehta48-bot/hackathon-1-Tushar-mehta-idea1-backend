import { plainToInstance } from 'class-transformer';
import { IsOptional, IsString, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsString()
  PORT?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsOptional()
  @IsString()
  SUPABASE_URL?: string;

  @IsOptional()
  @IsString()
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: true });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validated;
}

function normalizeSupabaseUrl(raw: string): string {
  return raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '');
}

export function requireSupabaseEnv(): {
  url: string;
  serviceRoleKey: string;
} {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL?.trim() ?? '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env or .env.local',
    );
  }
  return { url, serviceRoleKey };
}
