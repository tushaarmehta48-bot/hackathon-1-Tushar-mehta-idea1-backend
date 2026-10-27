import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../users/user.types.js';
import { BlogService } from './blog.service.js';
import { CreateBlogPostDto } from './dto/create-blog-post.dto.js';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto.js';

@Controller('admin/blog')
@Roles('ADMIN')
export class AdminBlogController {
  constructor(private readonly blog: BlogService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  list() {
    return this.blog.listAllAdmin();
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBlogPostDto) {
    return this.blog.create(user, dto);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBlogPostDto,
  ) {
    return this.blog.update(user, id, dto);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.blog.remove(user, id);
  }

  @Post('upload-image')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadImage(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    return this.blog.uploadImage(user, file);
  }
}
