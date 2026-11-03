import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ArchiveQuery, AuthorSummary, MediaSummary, Paged, PostDetail, PostSummary,
  PublicOptions, SiteBootstrap, TermSummary,
} from '@wp-clone/shared-types';
import { OptionsService } from '../options/options.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThemesService } from '../themes/themes.service';
import { MenusService } from '../menus/menus.service';

const POST_INCLUDE = {
  author: {
    select: {
      id: true, displayName: true, slug: true, bio: true,
      avatar: { select: { variants: true, altText: true } },
    },
  },
  terms: { include: { term: true } },
  featuredImage: true,
  _count: { select: { comments: { where: { status: 'APPROVED' } } } },
} as const;

type PostRow = {
  id: string; type: 'POST' | 'PAGE'; title: string; slug: string;
  excerpt: string | null; contentHtml: string; publishedAt: Date | null;
  updatedAt: Date; isSticky: boolean; commentStatus: 'OPEN' | 'CLOSED';
  seoTitle: string | null; seoDescription: string | null;
  canonicalUrl: string | null; noIndex: boolean;
  author: {
    id: string; displayName: string; slug: string; bio: string | null;
    avatar: { variants: unknown; altText: string | null } | null;
  };
  terms: { term: TermRow }[];
  featuredImage: MediaRow | null;
  _count: { comments: number };
};

type TermRow = {
  id: string; taxonomy: 'CATEGORY' | 'TAG'; name: string; slug: string;
  description: string | null; postCount: number; parentId: string | null;
  seoTitle: string | null; seoDescription: string | null;
};

type MediaRow = {
  id: string; filename: string; mimeType: string; size: number;
  width: number | null; height: number | null; altText: string | null;
  caption: string | null; variants: unknown;
};

/**
 * The only API surface the public site talks to. Everything here is
 * anonymous, published-content-only and shaped for SSR transfer state.
 */
@Injectable()
export class ContentService {
  constructor(
    private prisma: PrismaService,
    private options: OptionsService,
    private themes: ThemesService,
    private menus: MenusService,
  ) {}

  /** One round trip powering the layout of every page (site data + theme). */
  async bootstrap(): Promise<SiteBootstrap> {
    const [options, theme, menus, categories] = await Promise.all([
      this.options.publicOptions(),
      this.themes.getActive(),
      this.menus.list(),
      this.prisma.term.findMany({
        where: { taxonomy: 'CATEGORY', postCount: { gt: 0 } },
        orderBy: { postCount: 'desc' }, take: 12,
      }),
    ]);
    return {
      options,
      theme,
      menus,
      categories: categories.map((c) => this.mapTerm(c)),
    };
  }

  /** Home: static page (Reading settings) or the posts index. */
  async home(q: ArchiveQuery): Promise<Paged<PostSummary> & { staticPage?: PostDetail }> {
    const opts = await this.options.publicOptions();
    if (opts.homepageDisplays === 'page' && opts.homepageId) {
      const staticPage = await this.findPublishedPageById(opts.homepageId);
      return { items: [], total: 0, page: 1, perPage: opts.postsPerPage, staticPage };
    }
    return this.posts(q, {});
  }

  /** Posts (or a filtered archive) with pagination; sticky posts float on page 1. */
  async posts(
    q: ArchiveQuery,
    filter: { taxonomy?: 'CATEGORY' | 'TAG'; termSlug?: string; authorSlug?: string; search?: string },
  ): Promise<Paged<PostSummary>> {
    const opts = await this.options.publicOptions();
    const pageNo = Math.max(1, q.page ?? 1);
    const perPage = Math.min(50, Math.max(1, q.perPage ?? opts.postsPerPage));
    const base = this.base(opts);

    const termId =
      filter.taxonomy && filter.termSlug
        ? (await this.prisma.term.findUnique({
            where: { taxonomy_slug: { taxonomy: filter.taxonomy, slug: filter.termSlug } },
            select: { id: true },
          }))?.id
        : undefined;
    const authorId = filter.authorSlug
      ? (await this.prisma.user.findUnique({
          where: { slug: filter.authorSlug }, select: { id: true },
        }))?.id
      : undefined;

    const where: Record<string, unknown> = {
      type: 'POST',
      status: 'PUBLISHED',
      ...(termId
        ? { terms: { some: { termId } } }
        : {}),
      ...(authorId ? { authorId } : {}),
      ...(filter.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: 'insensitive' } },
              { contentHtml: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: POST_INCLUDE,
        orderBy: [{ isSticky: 'desc' }, { publishedAt: 'desc' }],
        skip: (pageNo - 1) * perPage,
        take: perPage,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items: items.map((p) => this.mapPost(p as unknown as PostRow, base)),
      total, page: pageNo, perPage,
    };
  }

  async post(slug: string): Promise<PostDetail> {
    const opts = await this.options.publicOptions();
    const post = await this.prisma.post.findFirst({
      where: { slug, status: 'PUBLISHED', type: 'POST' },
      include: POST_INCLUDE,
    });
    if (!post) throw new NotFoundException();
    return this.mapDetail(post as unknown as PostRow, this.base(opts));
  }

  async page(slug: string): Promise<PostDetail> {
    const opts = await this.options.publicOptions();
    const page = await this.prisma.post.findFirst({
      where: { slug, status: 'PUBLISHED', type: 'PAGE' },
      include: POST_INCLUDE,
    });
    if (!page) throw new NotFoundException();
    return this.mapDetail(page as unknown as PostRow, this.base(opts));
  }

  /** Top-level pages, ordered for menus. */
  async pages(): Promise<PostSummary[]> {
    const opts = await this.options.publicOptions();
    const rows = await this.prisma.post.findMany({
      where: { type: 'PAGE', status: 'PUBLISHED' },
      include: POST_INCLUDE,
      orderBy: { menuOrder: 'asc' },
    });
    return rows.map((p) => this.mapPost(p as unknown as PostRow, this.base(opts)));
  }

  /** Category or tag archive. */
  async taxonomy(
    taxonomy: 'CATEGORY' | 'TAG', slug: string, q: ArchiveQuery,
  ): Promise<{ term: TermSummary } & Paged<PostSummary>> {
    const term = await this.prisma.term.findUnique({
      where: { taxonomy_slug: { taxonomy, slug } },
    });
    if (!term) throw new NotFoundException();
    const archive = await this.posts(q, { taxonomy, termSlug: slug });
    return { term: this.mapTerm(term), ...archive };
  }

  /** Author archive (public profile + their posts). */
  async author(slug: string, q: ArchiveQuery): Promise<{
    author: AuthorSummary;
  } & Paged<PostSummary>> {
    const user = await this.prisma.user.findFirst({
      where: { slug, isActive: true },
      include: { avatar: { select: { variants: true, altText: true } } },
    });
    if (!user) throw new NotFoundException();
    const opts = await this.options.publicOptions();
    const base = this.base(opts);
    const archive = await this.posts(q, { authorSlug: slug });
    const av = user.avatar;
    const avatar: MediaSummary | null = av
      ? {
          id: `avatar-${user.id}`,
          url: this.abs((av.variants as { original?: string }).original, base) ?? '',
          filename: 'avatar',
          mimeType: 'image/webp',
          size: 0,
          altText: av.altText,
          variants: (av.variants ?? {}) as MediaSummary['variants'],
        }
      : null;
    return {
      author: {
        id: user.id, displayName: user.displayName, slug: user.slug,
        bio: user.bio, avatar,
      },
      ...archive,
    };
  }

  search(term: string, q: ArchiveQuery) {
    return this.posts(q, { search: term });
  }

  /** Consumed by the SSR server for real HTTP 301s when a slug changes. */
  async redirect(from: string): Promise<{ to: string; status: number } | null> {
    const row = await this.prisma.redirect.findUnique({ where: { fromPath: from } });
    return row ? { to: row.toPath, status: row.status } : null;
  }

  /* ------------------------------ mapping ------------------------------ */

  private base(opts: PublicOptions): string {
    return (opts.siteUrl || 'http://localhost:4200').replace(/\/$/, '');
  }

  private abs(url: string | null | undefined, base: string): string | undefined {
    if (!url) return undefined;
    return url.startsWith('/') ? `${base}${url}` : url;
  }

  private mapMedia(m: MediaRow | null, base: string): MediaSummary | null {
    if (!m) return null;
    const variants = (m.variants ?? {}) as MediaSummary['variants'];
    return {
      id: m.id,
      url: this.abs(variants.original, base) ?? '',
      filename: m.filename,
      mimeType: m.mimeType,
      size: m.size,
      width: m.width,
      height: m.height,
      altText: m.altText,
      caption: m.caption,
      variants: {
        original: this.abs(variants.original, base),
        webp: variants.webp
          ? Object.fromEntries(
              Object.entries(variants.webp).map(([w, u]) => [w, this.abs(u, base)!]),
            )
          : undefined,
      },
    };
  }

  private mapTerm(t: TermRow): TermSummary {
    return {
      id: t.id, taxonomy: t.taxonomy, name: t.name, slug: t.slug,
      description: t.description, postCount: t.postCount, parentId: t.parentId,
      seoTitle: t.seoTitle, seoDescription: t.seoDescription,
    };
  }

  private mapPost(p: PostRow, base: string): PostSummary {
    const categories = p.terms.filter((t) => t.term.taxonomy === 'CATEGORY').map((t) => this.mapTerm(t.term));
    const tags = p.terms.filter((t) => t.term.taxonomy === 'TAG').map((t) => this.mapTerm(t.term));
    return {
      id: p.id, type: p.type, title: p.title, slug: p.slug,
      url: `/${p.slug}/`,
      excerpt: p.excerpt,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
      isSticky: p.isSticky,
      commentStatus: p.commentStatus,
      commentCount: p._count.comments,
      author: {
        id: p.author.id,
        displayName: p.author.displayName,
        slug: p.author.slug,
        bio: p.author.bio,
        avatar: p.author.avatar
          ? this.mapMedia(
              { ...(p.author.avatar as unknown as MediaRow), id: 'avatar' }, base,
            )
          : null,
      },
      featuredImage: this.mapMedia(p.featuredImage, base),
      categories,
      tags,
    };
  }

  private mapDetail(p: PostRow, base: string): PostDetail {
    return {
      ...this.mapPost(p, base),
      contentHtml: p.contentHtml,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      canonicalUrl: p.canonicalUrl,
      noIndex: p.noIndex,
    };
  }

  private async findPublishedPageById(id: string): Promise<PostDetail | undefined> {
    const page = await this.prisma.post.findFirst({
      where: { id, type: 'PAGE', status: 'PUBLISHED' },
      include: POST_INCLUDE,
    });
    if (!page) return undefined;
    const opts = await this.options.publicOptions();
    return this.mapDetail(page as unknown as PostRow, this.base(opts));
  }
}
