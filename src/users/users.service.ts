import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { UserProfile } from './user.types.js';

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: UserProfile['role'];
  preferred_locale: string;
  active: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async getProfileByUserId(userId: string): Promise<UserProfile> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('profiles')
      .select('id, display_name, role, preferred_locale, active')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      throw new NotFoundException('Profile not found');
    }

    return this.mapProfile(data as ProfileRow);
  }

  async findProfileById(userId: string): Promise<UserProfile | null> {
    try {
      return await this.getProfileByUserId(userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }

  async syncProfileFromAuth(userId: string): Promise<UserProfile> {
    try {
      return await this.getProfileByUserId(userId);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }
    }

    const existing = await this.findProfileRowById(userId);
    if (existing) {
      return this.mapProfile(existing);
    }

    const { data, error } = await this.supabase
      .getAdminClient()
      .from('profiles')
      .insert({
        id: userId,
        role: 'CUSTOMER',
        preferred_locale: 'en',
      })
      .select('id, display_name, role, preferred_locale, active')
      .single();

    if (error) {
      const retry = await this.findProfileRowById(userId);
      if (retry) {
        return this.mapProfile(retry);
      }
      throw error;
    }

    return this.mapProfile(data as ProfileRow);
  }

  private async findProfileRowById(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('profiles')
      .select('id, display_name, role, preferred_locale, active')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return (data as ProfileRow | null) ?? null;
  }

  private mapProfile(row: ProfileRow): UserProfile {
    return {
      id: row.id,
      displayName: row.display_name,
      role: row.role,
      preferredLocale: row.preferred_locale,
      active: row.active,
    };
  }
}
