import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class StaffCreateReservationDto {
  @IsString()
  date!: string;

  @IsUUID()
  shiftId!: string;

  @IsISO8601()
  slotStartsAt!: string;

  @IsUUID()
  tableId!: string;

  @IsInt()
  @Min(1)
  partySize!: number;

  @IsEnum(['PHONE', 'WALK_IN'] as const)
  source!: 'PHONE' | 'WALK_IN';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialRequest?: string;
}
