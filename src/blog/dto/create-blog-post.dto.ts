import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateBlogPostDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsString()
  @MaxLength(50000)
  body!: string;

  @IsOptional()
  @ValidateIf((dto: CreateBlogPostDto) => Boolean(dto.coverImageUrl?.trim()))
  @IsUrl({ require_protocol: true })
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({ require_protocol: true }, { each: true })
  galleryUrls?: string[];

  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: 'draft' | 'published';
}
