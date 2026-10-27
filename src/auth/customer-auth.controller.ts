import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator.js';
import { CustomerSignUpDto } from './dto/customer-sign-up.dto.js';
import { CustomerAuthService } from './customer-auth.service.js';

@Public()
@Controller('auth/customer')
export class CustomerAuthController {
  constructor(private readonly customerAuth: CustomerAuthService) {}

  @Post('sign-up')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(@Body() body: CustomerSignUpDto) {
    return this.customerAuth.register(body.email, body.password);
  }
}
