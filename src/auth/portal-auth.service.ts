import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { UserRole } from '../users/user.types.js';
import { SupabaseService } from '../supabase/supabase.service.js';

type PortalKind = 'staff' | 'admin';

type PortalEnvConfig = {
  userId: string;
  password: string;
  email: string;
  role: UserRole;
  displayName: string;
};

export type PortalSessionResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

@Injectable()
export class PortalAuthService implements OnModuleInit {
  private readonly logger = new Logger(PortalAuthService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async onModuleInit(): Promise<void> {
    for (const portal of ['staff', 'admin'] as const) {
      const config = this.readPortalConfig(portal);
      if (!config) {
        this.logger.warn(
          `Portal credentials for "${portal}" are not configured; ${portal} sign-in disabled until env is set.`,
        );
        continue;
      }
      try {
        await this.ensurePortalUser(config);
        this.logger.log(`Portal user ready for ${portal} (${config.email})`);
      } catch (error) {
        const detail =
          error instanceof Error
            ? error.message
            : typeof error === 'object' && error !== null && 'message' in error
              ? String((error as { message: unknown }).message)
              : String(error);
        this.logger.error(`Failed to bootstrap ${portal} portal user: ${detail}`);
      }
    }
  }

  async signIn(portal: PortalKind, userId: string, password: string): Promise<PortalSessionResponse> {
    const config = this.readPortalConfig(portal);
    if (!config) {
      throw new ServiceUnavailableException('Portal sign-in is not configured on this server');
    }

    if (!this.matchesPortalLogin(userId, config) || !this.secretsMatch(password, config.password)) {
      throw new UnauthorizedException('Invalid user ID or password');
    }

    const client = this.supabase.createEphemeralServiceClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: config.email,
      password: config.password,
    });

    if (error || !data.session) {
      this.logger.error(`Supabase sign-in failed for ${portal}: ${error?.message ?? 'no session'}`);
      throw new UnauthorizedException('Invalid user ID or password');
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in ?? 3600,
      token_type: data.session.token_type ?? 'bearer',
    };
  }

  private readPortalConfig(portal: PortalKind): PortalEnvConfig | null {
    const prefix = portal === 'staff' ? 'STAFF' : 'ADMIN';
    const userId = process.env[`${prefix}_PORTAL_USER_ID`]?.trim();
    const password = process.env[`${prefix}_PORTAL_PASSWORD`]?.trim();
    const email = process.env[`${prefix}_PORTAL_EMAIL`]?.trim();
    if (!userId || !password || !email) {
      return null;
    }
    return {
      userId,
      password,
      email,
      role: portal === 'staff' ? 'STAFF' : 'ADMIN',
      displayName: portal === 'staff' ? 'Staff portal' : 'Admin portal',
    };
  }

  private matchesPortalLogin(provided: string, config: PortalEnvConfig): boolean {
    const trimmed = provided.trim();
    if (this.secretsMatch(trimmed, config.userId)) {
      return true;
    }
    return trimmed.toLowerCase() === config.email.toLowerCase();
  }

  private secretsMatch(provided: string, expected: string): boolean {
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  }

  private async ensurePortalUser(config: PortalEnvConfig): Promise<void> {
    const client = this.supabase.getAdminClient();
    const existing = await this.findUserByEmail(config.email);
    let userId: string;

    if (existing) {
      userId = existing.id;
      const { error: updateError } = await client.auth.admin.updateUserById(userId, {
        password: config.password,
        email_confirm: true,
      });
      if (updateError) {
        throw updateError;
      }
    } else {
      const { data, error } = await client.auth.admin.createUser({
        email: config.email,
        password: config.password,
        email_confirm: true,
      });
      if (error || !data.user) {
        const retry = error ? await this.findUserByEmail(config.email) : null;
        if (!retry) {
          throw error ?? new Error('createUser returned no user');
        }
        userId = retry.id;
        const { error: updateError } = await client.auth.admin.updateUserById(userId, {
          password: config.password,
          email_confirm: true,
        });
        if (updateError) {
          throw updateError;
        }
      } else {
        userId = data.user.id;
      }
    }

    const { error: profileError } = await client.rpc('upsert_portal_profile', {
      p_user_id: userId,
      p_role: config.role,
      p_display_name: config.displayName,
    });

    if (profileError) {
      throw profileError;
    }
  }

  private async findUserByEmail(email: string) {
    const client = this.supabase.getAdminClient();
    const normalized = email.toLowerCase();
    let page = 1;

    while (true) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        throw error;
      }
      const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
      if (match) {
        return match;
      }
      if (data.users.length < 200) {
        return null;
      }
      page += 1;
    }
  }
}
