import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';
import { AuditRepository } from '../ops/audit.repository.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { AuthenticatedUser } from '../users/user.types.js';
import { BlogRepository } from './blog.repository.js';
import type { BlogPostRecord, BlogPostView } from './blog.types.js';
import { CreateBlogPostDto } from './dto/create-blog-post.dto.js';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto.js';

const BLOG_BUCKET = 'blog-media';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

@Injectable()
export class BlogService {
  constructor(
    private readonly posts: BlogRepository,
    private readonly supabase: SupabaseService,
    private readonly audit: AuditRepository,
  ) {}

  listPublished(limit?: number): Promise<BlogPostView[]> {
    return this.posts.listPublished(limit).then((rows) => rows.map(mapPost));
  }

  listAllAdmin(): Promise<BlogPostView[]> {
    return this.posts.listAll().then((rows) => rows.map(mapPost));
  }

  async getPublishedBySlug(slug: string): Promise<BlogPostView> {
    const row = await this.posts.findPublishedBySlug(normalizeSlug(slug));
    if (!row) {
      throw new NotFoundException('Article not found');
    }
    return mapPost(row);
  }

  async create(actor: AuthenticatedUser, dto: CreateBlogPostDto): Promise<BlogPostView> {
    const slug = normalizeSlug(dto.slug);
    const status = dto.status ?? 'draft';
    const publishedAt = status === 'published' ? new Date().toISOString() : null;

    let row: BlogPostRecord;
    try {
      row = await this.posts.insert({
        slug,
        title: dto.title.trim(),
        excerpt: dto.excerpt?.trim() || null,
        body: dto.body,
        coverImageUrl: dto.coverImageUrl?.trim() || null,
        galleryUrls: dto.galleryUrls ?? [],
        status,
        publishedAt,
        authorId: actor.id,
      });
    } catch (error) {
      if (error instanceof Error && (error as Error & { code?: string }).code === 'SLUG_CONFLICT') {
        throw new ConflictException({ code: 'SLUG_CONFLICT', message: 'Slug already in use' });
      }
      throw error;
    }

    await this.audit.log({
      actorId: actor.id,
      action: 'blog_post.created',
      entityType: 'blog_post',
      entityId: row.id,
      metadata: { slug, status },
    });

    return mapPost(row);
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateBlogPostDto): Promise<BlogPostView> {
    const existing = await this.posts.findById(id);
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    const nextStatus = dto.status ?? existing.status;
    let publishedAt = existing.published_at;
    if (dto.status === 'published' && existing.status !== 'published') {
      publishedAt = new Date().toISOString();
    }
    if (dto.status === 'draft') {
      publishedAt = null;
    }

    let row: BlogPostRecord | null;
    try {
      row = await this.posts.update(id, {
        slug: dto.slug !== undefined ? normalizeSlug(dto.slug) : undefined,
        title: dto.title?.trim(),
        excerpt: dto.excerpt !== undefined ? dto.excerpt?.trim() || null : undefined,
        body: dto.body,
        coverImageUrl:
          dto.coverImageUrl !== undefined ? dto.coverImageUrl?.trim() || null : undefined,
        galleryUrls: dto.galleryUrls,
        status: nextStatus,
        publishedAt,
      });
    } catch (error) {
      if (error instanceof Error && (error as Error & { code?: string }).code === 'SLUG_CONFLICT') {
        throw new ConflictException({ code: 'SLUG_CONFLICT', message: 'Slug already in use' });
      }
      throw error;
    }

    if (!row) {
      throw new NotFoundException('Article not found');
    }

    await this.audit.log({
      actorId: actor.id,
      action: 'blog_post.updated',
      entityType: 'blog_post',
      entityId: id,
      metadata: { slug: row.slug, status: row.status },
    });

    return mapPost(row);
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<{ ok: true }> {
    const existing = await this.posts.findById(id);
    if (!existing) {
      throw new NotFoundException('Article not found');
    }
    await this.posts.delete(id);
    await this.audit.log({
      actorId: actor.id,
      action: 'blog_post.deleted',
      entityType: 'blog_post',
      entityId: id,
      metadata: { slug: existing.slug },
    });
    return { ok: true };
  }

  async uploadImage(
    actor: AuthenticatedUser,
    file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Unsupported image type');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image must be 5 MB or smaller');
    }

    const ext = safeImageExt(file.originalname, file.mimetype);
    const objectPath = `${new Date().toISOString().slice(0, 10)}/${randomBytes(12).toString('hex')}.${ext}`;

    const { error } = await this.supabase.getAdminClient().storage.from(BLOG_BUCKET).upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

    if (error) {
      throw new BadRequestException(
        error.message.includes('Bucket not found')
          ? 'Blog storage is not configured. Run migration 20251027170000_blog_posts.sql in Supabase.'
          : error.message,
      );
    }

    const { data } = this.supabase.getAdminClient().storage.from(BLOG_BUCKET).getPublicUrl(objectPath);

    await this.audit.log({
      actorId: actor.id,
      action: 'blog_media.uploaded',
      entityType: 'blog_media',
      entityId: objectPath,
      metadata: { url: data.publicUrl },
    });

    return { url: data.publicUrl };
  }
}

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function safeImageExt(filename: string, mime: string): string {
  const fromName = extname(filename).replace('.', '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}

function mapPost(row: BlogPostRecord): BlogPostView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    coverImageUrl: row.cover_image_url,
    galleryUrls: row.gallery_urls ?? [],
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
