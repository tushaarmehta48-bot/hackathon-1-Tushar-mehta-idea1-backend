import { IsIn, IsInt, IsString, Min } from 'class-validator';

export class PaymentWebhookDto {
  @IsString()
  idempotencyKey!: string;

  @IsIn(['payment.captured', 'payment.failed'])
  event!: 'payment.captured' | 'payment.failed';

  @IsInt()
  @Min(1)
  timestamp!: number;
}
