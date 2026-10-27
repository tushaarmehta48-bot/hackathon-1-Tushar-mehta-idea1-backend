import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseEnv } from '../config/env.schema.js';
import { assertSupabaseServiceRoleKey } from './supabase-key.util.js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private adminClient: SupabaseClient | null = null;

  onModuleInit(): void {
    const { serviceRoleKey } = requireSupabaseEnv();
    assertSupabaseServiceRoleKey(serviceRoleKey);
    this.logger.log('Supabase service_role key validated');
  }

  /** Shared client for DB + Auth Admin API. Never call `signIn*` on it — use {@link createEphemeralServiceClient}. */
  getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      this.adminClient = this.buildServiceClient();
    }
    return this.adminClient;
  }

  /**
   * Short-lived client for password sign-in (staff/admin portal).
   * Isolated so portal sessions do not replace the service role on {@link getAdminClient}.
   */
  createEphemeralServiceClient(): SupabaseClient {
    return this.buildServiceClient();
  }

  private buildServiceClient(): SupabaseClient {
    const { url, serviceRoleKey } = requireSupabaseEnv();
    assertSupabaseServiceRoleKey(serviceRoleKey);
    return createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  async verifyAccessToken(accessToken: string) {
    try {
      const { data, error } = await this.getAdminClient().auth.getUser(accessToken);
      if (error || !data.user) {
        return null;
      }
      return data.user;
    } catch {
      return null;
    }
  }
}
