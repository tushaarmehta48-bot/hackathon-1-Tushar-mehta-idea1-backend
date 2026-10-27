import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { ReservationsModule } from '../reservations/reservations.module.js';
import { SchedulesModule } from '../schedules/schedules.module.js';
import { StaffReservationsController } from './staff-reservations.controller.js';
import { StaffReservationsService } from './staff-reservations.service.js';

@Module({
  imports: [AvailabilityModule, SchedulesModule, ReservationsModule],
  controllers: [StaffReservationsController],
  providers: [StaffReservationsService],
})
export class StaffModule {}
