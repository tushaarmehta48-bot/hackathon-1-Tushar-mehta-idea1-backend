import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class CheckInScanDto {
  @ValidateIf((dto: CheckInScanDto) => !dto.reference)
  @IsString()
  @MaxLength(128)
  token?: string;

  @ValidateIf((dto: CheckInScanDto) => !dto.token)
  @IsString()
  @MaxLength(32)
  reference?: string;
}
