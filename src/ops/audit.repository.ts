import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class AuditRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async log(input: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.getAdminClient().from('audit_logs').insert({
      actor_id: input.actorId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      metadata: input.metadata ?? {},
    });

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
  }
}
