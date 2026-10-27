import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDiningAreaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(['INDOOR', 'OUTDOOR', 'MIXED'] as const)
  areaType?: 'INDOOR' | 'OUTDOOR' | 'MIXED';

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateDiningAreaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(['INDOOR', 'OUTDOOR', 'MIXED'] as const)
  areaType?: 'INDOOR' | 'OUTDOOR' | 'MIXED';

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateTableDto {
  @IsUUID()
  areaId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  label!: string;

  @IsInt()
  @Min(1)
  minCapacity!: number;

  @IsInt()
  @Min(1)
  maxCapacity!: number;

  @IsOptional()
  @IsNumber()
  svgX?: number;

  @IsOptional()
  @IsNumber()
  svgY?: number;

  @IsOptional()
  @IsNumber()
  svgWidth?: number;

  @IsOptional()
  @IsNumber()
  svgHeight?: number;

  @IsOptional()
  @IsNumber()
  svgRotationDeg?: number;

  @IsOptional()
  @IsEnum(['STANDARD', 'PREMIUM', 'GROUP'] as const)
  tableTier?: 'STANDARD' | 'PREMIUM' | 'GROUP';
}

export class UpdateTableDto {
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  minCapacity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxCapacity?: number;

  @IsOptional()
  @IsNumber()
  svgX?: number;

  @IsOptional()
  @IsNumber()
  svgY?: number;

  @IsOptional()
  @IsNumber()
  svgWidth?: number;

  @IsOptional()
  @IsNumber()
  svgHeight?: number;

  @IsOptional()
  @IsNumber()
  svgRotationDeg?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  bookable?: boolean;

  @IsOptional()
  @IsEnum(['STANDARD', 'PREMIUM', 'GROUP'] as const)
  tableTier?: 'STANDARD' | 'PREMIUM' | 'GROUP';
}

export class CreateShiftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @IsOptional()
  @IsString()
  serviceDate?: string;

  @IsString()
  startsAt!: string;

  @IsString()
  endsAt!: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  defaultDurationMinutes?: number;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number | null;

  @IsOptional()
  @IsString()
  serviceDate?: string | null;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  defaultDurationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateSeasonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  startsOn!: string;

  @IsString()
  endsOn!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateSeasonDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  startsOn?: string;

  @IsOptional()
  @IsString()
  endsOn?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CreateExceptionDto {
  @IsString()
  exceptionDate!: string;

  @IsBoolean()
  isClosed!: boolean;

  @IsOptional()
  @IsISO8601()
  opensAt?: string;

  @IsOptional()
  @IsISO8601()
  closesAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class UpdateBookingPolicyDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minNoticeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAdvanceDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cancellationDeadlineMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minPartySize?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPartySize?: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  defaultDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  turnoverBufferMinutes?: number;

  @IsOptional()
  @IsBoolean()
  depositRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  depositAmountCents?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  depositCurrency?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  depositHoldMinutes?: number;
}

export class CreateTableBlockDto {
  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class AssignStaffRoleDto {
  @IsUUID()
  userId!: string;

  @IsEnum(['STAFF', 'CUSTOMER'] as const)
  role!: 'STAFF' | 'CUSTOMER';
}

export class AdminReportQueryDto {
  @IsString()
  from!: string;

  @IsString()
  to!: string;
}

export class AdminExceptionsQueryDto {
  @IsString()
  from!: string;

  @IsString()
  to!: string;
}
