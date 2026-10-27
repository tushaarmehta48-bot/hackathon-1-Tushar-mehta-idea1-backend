import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async enqueue(input: {
    reservationId: string;
    userId: string | null;
    locale: string;
    templateKey: string;
    channel?: string;
  }): Promise<void> {
    const { error } = await this.supabase.getAdminClient().from('notifications').insert({
      reservation_id: input.reservationId,
      user_id: input.userId,
      locale: input.locale,
      template_key: input.templateKey,
      channel: input.channel ?? 'email',
      status: 'PENDING',
    });

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
  }
}
