import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../users/user.types.js';
import { StaffCreateReservationDto } from './dto/staff-create-reservation.dto.js';
import { StaffDayQueryDto } from './dto/staff-day-query.dto.js';
import { StaffReservationsService } from './staff-reservations.service.js';

@Controller('staff/reservations')
export class StaffReservationsController {
  constructor(private readonly staffReservations: StaffReservationsService) {}

  @Get()
  @Roles('STAFF', 'ADMIN')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  listDay(@Query() query: StaffDayQueryDto) {
    return this.staffReservations.listDay(query.date, query.q);
  }

  @Post()
  @Roles('STAFF', 'ADMIN')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: StaffCreateReservationDto) {
    return this.staffReservations.create(user, dto);
  }
}
