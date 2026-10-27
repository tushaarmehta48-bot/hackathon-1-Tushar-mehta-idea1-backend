import { IsIn, IsString, MinLength } from 'class-validator';

export class PortalSignInDto {
  @IsIn(['staff', 'admin'])
  portal!: 'staff' | 'admin';

  @IsString()
  @MinLength(1)
  userId!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
