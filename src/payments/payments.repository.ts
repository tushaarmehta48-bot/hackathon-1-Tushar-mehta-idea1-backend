import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

export type PaymentRecord = {
  id: string;
  reservation_id: string;
  provider: string;
  provider_payment_id: string | null;
  provider_checkout_session_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
};

type InsertPaymentInput = {
  reservationId: string;
  provider: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  providerCheckoutSessionId?: string | null;
};

@Injectable()
export class PaymentsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async insertPayment(input: InsertPaymentInput): Promise<PaymentRecord> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('payments')
      .insert({
        reservation_id: input.reservationId,
        provider: input.provider,
        amount_cents: input.amountCents,
        currency: input.currency,
        idempotency_key: input.idempotencyKey,
        provider_checkout_session_id: input.providerCheckoutSessionId ?? null,
        status: 'PENDING',
      })
      .select('*')
      .single();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return data as PaymentRecord;
  }

  async findByIdempotencyKey(key: string): Promise<PaymentRecord | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('payments')
      .select('*')
      .eq('idempotency_key', key)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return (data as PaymentRecord | null) ?? null;
  }

  async findLatestForReservation(reservationId: string): Promise<PaymentRecord | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('payments')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return (data as PaymentRecord | null) ?? null;
  }

  async markCaptured(
    paymentId: string,
    providerPaymentId: string | null,
  ): Promise<PaymentRecord | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('payments')
      .update({
        status: 'CAPTURED',
        provider_payment_id: providerPaymentId,
      })
      .eq('id', paymentId)
      .eq('status', 'PENDING')
      .select('*')
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return (data as PaymentRecord | null) ?? null;
  }

  async markCancelled(paymentId: string): Promise<void> {
    const { error } = await this.supabase
      .getAdminClient()
      .from('payments')
      .update({ status: 'CANCELLED' })
      .eq('id', paymentId)
      .in('status', ['PENDING', 'AUTHORIZED']);

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
  }
}
