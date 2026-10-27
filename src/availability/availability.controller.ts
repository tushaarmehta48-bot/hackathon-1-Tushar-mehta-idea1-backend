import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator.js';
import { AvailabilityService } from './availability.service.js';
import { AvailabilityQueryDto, FloorPlanQueryDto } from './dto/availability-query.dto.js';

@Controller()
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Public()
  @Get('availability')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getAvailability(@Query() query: AvailabilityQueryDto) {
    return this.availability.getAvailability(query);
  }

  @Public()
  @Get('floor-plan')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getFloorPlan(@Query() query: FloorPlanQueryDto) {
    return this.availability.getFloorPlan(query);
  }
}
