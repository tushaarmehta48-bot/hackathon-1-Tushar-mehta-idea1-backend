import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator.js';
import { BlogService } from './blog.service.js';

@Controller('blog')
@Public()
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  list(@Query('limit') limit?: string) {
    const parsed = limit ? Math.min(24, Math.max(1, Number(limit))) : 12;
    return this.blog.listPublished(Number.isFinite(parsed) ? parsed : 12);
  }

  @Get(':slug')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getBySlug(@Param('slug') slug: string) {
    return this.blog.getPublishedBySlug(slug);
  }
}
