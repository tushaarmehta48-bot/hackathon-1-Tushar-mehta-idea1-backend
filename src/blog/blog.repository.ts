import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { BlogPostRecord } from './blog.types.js';

type InsertBlogPost = {
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverImageUrl: string | null;
  galleryUrls: string[];
  status: 'draft' | 'published';
  publishedAt: string | null;
  authorId: string;
};

type UpdateBlogPost = Partial<Omit<InsertBlogPost, 'authorId'>>;

@Injectable()
export class BlogRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private selectColumns =
    'id, slug, title, excerpt, body, cover_image_url, gallery_urls, status, published_at, author_id, created_at, updated_at';

  async listPublished(limit = 12): Promise<BlogPostRecord[]> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('blog_posts')
      .select(this.selectColumns)
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return (data as unknown as BlogPostRecord[]) ?? [];
  }

  async listAll(): Promise<BlogPostRecord[]> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('blog_posts')
      .select(this.selectColumns)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return (data as unknown as BlogPostRecord[]) ?? [];
  }

  async findBySlug(slug: string): Promise<BlogPostRecord | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('blog_posts')
      .select(this.selectColumns)
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return (data as BlogPostRecord | null) ?? null;
  }

  async findPublishedBySlug(slug: string): Promise<BlogPostRecord | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('blog_posts')
      .select(this.selectColumns)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return (data as BlogPostRecord | null) ?? null;
  }

  async findById(id: string): Promise<BlogPostRecord | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('blog_posts')
      .select(this.selectColumns)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return (data as BlogPostRecord | null) ?? null;
  }

  async insert(input: InsertBlogPost): Promise<BlogPostRecord> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('blog_posts')
      .insert({
        slug: input.slug,
        title: input.title,
        excerpt: input.excerpt,
        body: input.body,
        cover_image_url: input.coverImageUrl,
        gallery_urls: input.galleryUrls,
        status: input.status,
        published_at: input.publishedAt,
        author_id: input.authorId,
      })
      .select(this.selectColumns)
      .single();

    if (error) {
      if (error.code === '23505') {
        const conflict = new Error('Slug already in use');
        (conflict as Error & { code?: string }).code = 'SLUG_CONFLICT';
        throw conflict;
      }
      throw new ServiceUnavailableException(error.message);
    }
    return data as unknown as BlogPostRecord;
  }

  async update(id: string, patch: UpdateBlogPost): Promise<BlogPostRecord | null> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.slug !== undefined) row.slug = patch.slug;
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.excerpt !== undefined) row.excerpt = patch.excerpt;
    if (patch.body !== undefined) row.body = patch.body;
    if (patch.coverImageUrl !== undefined) row.cover_image_url = patch.coverImageUrl;
    if (patch.galleryUrls !== undefined) row.gallery_urls = patch.galleryUrls;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.publishedAt !== undefined) row.published_at = patch.publishedAt;

    const { data, error } = await this.supabase
      .getAdminClient()
      .from('blog_posts')
      .update(row)
      .eq('id', id)
      .select(this.selectColumns)
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        const conflict = new Error('Slug already in use');
        (conflict as Error & { code?: string }).code = 'SLUG_CONFLICT';
        throw conflict;
      }
      throw new ServiceUnavailableException(error.message);
    }
    return (data as BlogPostRecord | null) ?? null;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.getAdminClient().from('blog_posts').delete().eq('id', id);
    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
  }
}
