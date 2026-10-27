import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReservationDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialRequest?: string;

  @IsBoolean()
  acceptedTerms!: boolean;
}
