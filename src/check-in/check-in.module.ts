import { Module } from '@nestjs/common';
import { ReservationsModule } from '../reservations/reservations.module.js';
import { AuditRepository } from '../ops/audit.repository.js';
import { CheckInController } from './check-in.controller.js';
import { CheckInService } from './check-in.service.js';

@Module({
  imports: [ReservationsModule],
  controllers: [CheckInController],
  providers: [CheckInService, AuditRepository],
})
export class CheckInModule {}
