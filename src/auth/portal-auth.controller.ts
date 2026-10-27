import { Body, Controller, Post } from '@nestjs/common';
import { Public } from './decorators/public.decorator.js';
import { PortalSignInDto } from './dto/portal-sign-in.dto.js';
import { PortalAuthService } from './portal-auth.service.js';

@Public()
@Controller('auth/portal')
export class PortalAuthController {
  constructor(private readonly portalAuth: PortalAuthService) {}

  @Post('sign-in')
  signIn(@Body() body: PortalSignInDto) {
    return this.portalAuth.signIn(body.portal, body.userId, body.password);
  }
}
