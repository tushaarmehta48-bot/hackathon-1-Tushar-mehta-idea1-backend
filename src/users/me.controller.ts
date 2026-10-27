import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from './user.types.js';

@Controller()
export class MeController {
  @Get('me')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  me(@CurrentUser() user: AuthenticatedUser) {
    return {
      id: user.id,
      email: user.email ?? null,
      profile: {
        displayName: user.profile.displayName,
        role: user.profile.role,
        preferredLocale: user.profile.preferredLocale,
      },
    };
  }
}
