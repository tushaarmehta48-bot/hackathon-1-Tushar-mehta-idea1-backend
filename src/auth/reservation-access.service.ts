import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { AuthenticatedUser, UserRole } from '../users/user.types.js';

@Injectable()
export class ReservationAccessService {
  constructor(private readonly supabase: SupabaseService) {}

  async assertCanReadReservation(
    user: AuthenticatedUser,
    reservationId: string,
  ): Promise<void> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .select('id, customer_id')
      .eq('id', reservationId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      throw new NotFoundException('Reservation not found');
    }

    if (this.isStaffOrAdmin(user.profile.role)) {
      return;
    }

    if (data.customer_id !== user.id) {
      throw new ForbiddenException('You cannot access this reservation');
    }
  }

  private isStaffOrAdmin(role: UserRole): boolean {
    return role === 'STAFF' || role === 'ADMIN';
  }
}
