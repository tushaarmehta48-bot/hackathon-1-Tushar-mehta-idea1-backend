import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsISO8601, IsOptional, IsUUID, Min } from 'class-validator';

export class AvailabilityQueryDto {
  @IsDateString()
  date!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  partySize!: number;

  @IsOptional()
  @IsUUID()
  shiftId?: string;
}

export class FloorPlanQueryDto extends AvailabilityQueryDto {
  @IsOptional()
  @IsISO8601()
  slotStartsAt?: string;
}
