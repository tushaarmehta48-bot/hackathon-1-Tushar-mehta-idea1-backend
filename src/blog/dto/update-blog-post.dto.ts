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

export class UpdateBlogPostDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  body?: string;

  @ValidateIf((dto: UpdateBlogPostDto) => dto.coverImageUrl != null && dto.coverImageUrl !== '')
  @IsUrl({ require_protocol: true })
  coverImageUrl?: string | null;

  @IsOptional()
  @IsArray()
  @IsUrl({ require_protocol: true }, { each: true })
  galleryUrls?: string[];

  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: 'draft' | 'published';
}
