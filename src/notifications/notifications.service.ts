import { Injectable, Logger } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly notifications: NotificationsRepository) {}

  async enqueueBookingConfirmation(input: {
    reservationId: string;
    userId: string | null;
    locale: string;
    reference: string;
    startsAt: string;
  }): Promise<void> {
    await this.notifications.enqueue({
      reservationId: input.reservationId,
      userId: input.userId,
      locale: input.locale,
      templateKey: 'booking_confirmation',
    });

    this.logger.log(
      `Queued booking_confirmation for ${input.reference} (${input.locale}) at ${input.startsAt}`,
    );
  }
}
