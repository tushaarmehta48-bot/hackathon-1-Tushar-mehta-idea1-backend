import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../users/user.types.js';
import { CheckInService } from './check-in.service.js';
import { CheckInScanDto } from './dto/check-in-scan.dto.js';

@Controller('check-in')
export class CheckInController {
  constructor(private readonly checkIn: CheckInService) {}

  @Get('history/mine')
  @Roles('STAFF', 'ADMIN')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  myHistory(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 50;
    return this.checkIn.listMyHistory(user, Number.isFinite(parsed) ? parsed : 50);
  }

  @Post('scan')
  @Roles('STAFF', 'ADMIN')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  scan(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckInScanDto) {
    return this.checkIn.scan(user, dto);
  }

  @Post(':id/confirm')
  @Roles('STAFF', 'ADMIN')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  confirm(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.checkIn.confirm(user, id);
  }
}
