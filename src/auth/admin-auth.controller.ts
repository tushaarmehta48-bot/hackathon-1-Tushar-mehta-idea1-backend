import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from './decorators/roles.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../users/user.types.js';

@Controller('admin')
@Roles('ADMIN')
export class AdminAuthController {
  @Get('session')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  session(@CurrentUser() user: AuthenticatedUser) {
    return {
      ok: true,
      role: user.profile.role,
      userId: user.id,
    };
  }
}
