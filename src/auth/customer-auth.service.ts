import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly users: UsersService,
  ) {}

  async register(email: string, password: string): Promise<{ ok: true }> {
    const normalized = email.trim().toLowerCase();
    const client = this.supabase.getAdminClient();

    const { data, error } = await client.auth.admin.createUser({
      email: normalized,
      password,
      email_confirm: true,
    });

    if (error) {
      const message = error.message ?? 'Sign-up failed';
      if (/already|registered|exists/i.test(message)) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'An account with this email already exists. Sign in instead.',
        });
      }
      this.logger.warn(`Customer sign-up failed: ${message}`);
      throw new BadRequestException({
        code: 'SIGN_UP_FAILED',
        message,
      });
    }

    if (!data.user) {
      throw new BadRequestException({
        code: 'SIGN_UP_FAILED',
        message: 'Account could not be created',
      });
    }

    await this.users.syncProfileFromAuth(data.user.id);
    return { ok: true };
  }
}
