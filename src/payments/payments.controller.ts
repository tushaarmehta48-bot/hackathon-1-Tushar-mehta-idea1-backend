import { Body, Controller, Headers, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../users/user.types.js';
import { CreateCheckoutDto } from './dto/create-checkout.dto.js';
import { PaymentWebhookDto } from './dto/payment-webhook.dto.js';
import { PaymentCaptureService } from './payment-capture.service.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly capture: PaymentCaptureService,
  ) {}

  @Post('checkout')
  @Roles('CUSTOMER')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createCheckout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCheckoutDto) {
    return this.payments.createCheckout(user, dto.reservationId);
  }

  @Post('dev/simulate-capture')
  @Roles('CUSTOMER')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  devSimulate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCheckoutDto) {
    return this.payments.devSimulateCapture(user, dto.reservationId);
  }

  @Post('webhook')
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  webhook(
    @Headers('x-payment-signature') signature: string | undefined,
    @Body() body: PaymentWebhookDto,
  ) {
    return this.capture.applyWebhookEvent(
      {
        idempotencyKey: body.idempotencyKey,
        event: body.event,
        timestamp: body.timestamp,
      },
      signature,
    );
  }
}
