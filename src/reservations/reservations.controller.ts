import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../users/user.types.js';
import { CreateReservationDto } from './dto/create-reservation.dto.js';
import { ReservationsService } from './reservations.service.js';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post()
  @Roles('CUSTOMER')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReservationDto) {
    return this.reservations.create(user, dto);
  }

  @Get('mine')
  @Roles('CUSTOMER')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.reservations.listMine(user);
  }

  @Get(':id/check-in-pass')
  @Roles('CUSTOMER')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getCheckInPass(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reservations.getCheckInPass(user, id);
  }

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reservations.getById(user, id);
  }

  @Post(':id/cancel')
  @Roles('CUSTOMER')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reservations.cancel(user, id);
  }
}
