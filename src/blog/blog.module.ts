import { Module } from '@nestjs/common';
import { AuditRepository } from '../ops/audit.repository.js';
import { AdminBlogController } from './admin-blog.controller.js';
import { BlogController } from './blog.controller.js';
import { BlogRepository } from './blog.repository.js';
import { BlogService } from './blog.service.js';

@Module({
  controllers: [BlogController, AdminBlogController],
  providers: [BlogService, BlogRepository, AuditRepository],
  exports: [BlogService],
})
export class BlogModule {}
