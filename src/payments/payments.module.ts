import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ReservationsModule } from '../reservations/reservations.module.js';
import { SchedulesModule } from '../schedules/schedules.module.js';
import { UsersModule } from '../users/users.module.js';
import { PaymentCaptureService } from './payment-capture.service.js';
import { PaymentExpiryService } from './payment-expiry.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsRepository } from './payments.repository.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [AuthModule, ReservationsModule, SchedulesModule, NotificationsModule, UsersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsRepository,
    PaymentsService,
    PaymentCaptureService,
    PaymentExpiryService,
  ],
  exports: [PaymentsRepository, PaymentCaptureService],
})
export class PaymentsModule {}
