import {
  ForbiddenException, Injectable, Logger, NotFoundException,
  OnModuleDestroy, OnModuleInit,
} from '@nestjs/common';
import { generateHTML } from '@tiptap/html/server';
import StarterKit from '@tiptap/starter-kit';
import { AuthUser, Capability, roleCan } from '@wp-clone/shared-types';
import { slugify, uniqueSlug } from '../common/util/slug';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto, ListPostsQuery, PostStatusName, UpdatePostDto } from './dto/post.dto';

type PostType = 'POST' | 'PAGE';
type CapSet = { edit: Capability; publish: Capability; del: Capability };
const caps = (t: PostType): CapSet =>
  t === 'PAGE'
    ? { edit: 'edit_pages', publish: 'publish_pages', del: 'delete_pages' }
    : { edit: 'edit_posts', publish: 'publish_posts', del: 'delete_posts' };

const INCLUDE = {
  author: { select: { id: true, displayName: true, slug: true } },
  terms: { include: { term: true } },
} as const;

@Injectable()
export class PostsService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger(PostsService.name);
  private timer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {}

  /** Publishes scheduled posts whose time has come (checked every minute). */
  onModuleInit() {
    this.timer = setInterval(() => void this.publishDue(), 60_000);
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  async publishDue() {
    const r = await this.prisma.post
      .updateMany({
        where: { status: 'SCHEDULED', publishedAt: { lte: new Date() } },
        data: { status: 'PUBLISHED' },
      })
      .catch((e: unknown) => { this.log.error(e); return { count: 0 }; });
    if (r.count) {
      this.log.log(`Published ${r.count} scheduled item(s)`);
      await this.recountTerms();
    }
  }

  private render(content: Record<string, unknown>): string {
    return generateHTML(content as never, [StarterKit]);
  }

  private can(user: AuthUser, cap: Capability) { return roleCan(user.role, cap); }

  /** WordPress rules: authors/contributors only touch their own; contributors can't publish. */
  private assertCanEdit(user: AuthUser, post: { type: PostType; authorId: string; status: string }) {
    const c = caps(post.type);
    if (!this.can(user, c['edit'])) throw new ForbiddenException();
    const own = post.authorId === user.id;
    if (post.type === 'POST' && !own && !this.can(user, 'edit_others_posts')) throw new ForbiddenException();
    if (user.role === 'CONTRIBUTOR' && post.status === 'PUBLISHED') throw new ForbiddenException();
  }

  /** Normalises requested status/date against the user's rights. */
  private resolveStatus(
    user: AuthUser, type: PostType,
    status: PostStatusName | undefined, publishedAt?: string,
  ): { status: PostStatusName; publishedAt: Date | null } {
    let s: PostStatusName = status ?? 'DRAFT';
    if ((s === 'PUBLISHED' || s === 'SCHEDULED') && !this.can(user, caps(type)['publish'])) s = 'PENDING';
    let date = publishedAt ? new Date(publishedAt) : null;
    if (s === 'PUBLISHED') {
      if (date && date.getTime() > Date.now()) s = 'SCHEDULED';
      else date = date ?? new Date();
    }
    if (s === 'SCHEDULED' && (!date || date.getTime() <= Date.now())) {
      s = 'PUBLISHED'; date = new Date();
    }
    return { status: s, publishedAt: date };
  }

  async list(q: ListPostsQuery, user: AuthUser) {
    const type = q.type ?? 'POST';
    const page = q.page ?? 1, perPage = q.perPage ?? 20;
    const where: Record<string, unknown> = {
      type,
      status: q.status ?? { not: 'TRASH' },
      ...(q.search ? { title: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    if (type === 'POST' && !this.can(user, 'edit_others_posts')) where['authorId'] = user.id;
    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where, include: INCLUDE, orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * perPage, take: perPage,
        omit: { content: true, contentHtml: true },
      }),
      this.prisma.post.count({ where }),
    ]);
    return { items, total, page, perPage };
  }

  async get(id: string, user: AuthUser) {
    const post = await this.prisma.post.findUnique({ where: { id }, include: INCLUDE });
    if (!post) throw new NotFoundException();
    this.assertCanEdit(user, post);
    return post;
  }

  async create(dto: CreatePostDto, user: AuthUser) {
    const type: PostType = dto.type ?? 'POST';
    if (!this.can(user, caps(type)['edit'])) throw new ForbiddenException();
    const { status, publishedAt } = this.resolveStatus(user, type, dto.status, dto.publishedAt);
    const slug = await uniqueSlug(slugify(dto.slug ?? dto.title), async (s) =>
      !!(await this.prisma.post.findUnique({ where: { type_slug: { type, slug: s } } })),
    );
    const post = await this.prisma.post.create({
      data: {
        type, status, publishedAt, slug,
        title: dto.title,
        excerpt: dto.excerpt,
        content: dto.content as never,
        contentHtml: this.render(dto.content),
        authorId: user.id,
        featuredImageId: dto.featuredImageId,
        parentId: type === 'PAGE' ? dto.parentId : undefined,
        template: dto.template,
        commentStatus: dto.commentStatus,
        isSticky: dto.isSticky && this.can(user, 'edit_others_posts'),
        seoTitle: dto.seoTitle, seoDescription: dto.seoDescription,
        canonicalUrl: dto.canonicalUrl, noIndex: dto.noIndex,
        terms: dto.termIds?.length
          ? { create: dto.termIds.map((termId) => ({ termId })) }
          : undefined,
      },
      include: INCLUDE,
    });
    await this.recountTerms();
    return post;
  }

  async update(id: string, dto: UpdatePostDto, user: AuthUser) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException();
    this.assertCanEdit(user, post);
    const type = post.type as PostType;

    const data: Record<string, unknown> = {
      title: dto.title, excerpt: dto.excerpt, featuredImageId: dto.featuredImageId,
      template: dto.template, commentStatus: dto.commentStatus,
      seoTitle: dto.seoTitle, seoDescription: dto.seoDescription,
      canonicalUrl: dto.canonicalUrl, noIndex: dto.noIndex,
    };
    if (type === 'PAGE' && dto.parentId !== undefined) {
      if (dto.parentId === id) throw new ForbiddenException('A page cannot be its own parent');
      data['parentId'] = dto.parentId;
    }
    if (dto.isSticky !== undefined && this.can(user, 'edit_others_posts')) data['isSticky'] = dto.isSticky;

    if (dto.content) {
      data['content'] = dto.content;
      data['contentHtml'] = this.render(dto.content);
      await this.prisma.postRevision.create({
        data: { postId: id, authorId: user.id, title: post.title, content: post.content as never },
      });
    }

    if (dto.status !== undefined || dto.publishedAt !== undefined) {
      const r = this.resolveStatus(
        user, type, dto.status ?? (post.status as PostStatusName),
        dto.publishedAt ?? post.publishedAt?.toISOString(),
      );
      if (dto.status === 'TRASH') {
        if (!this.can(user, caps(type)['del'])) throw new ForbiddenException();
        data['status'] = 'TRASH';
      } else {
        data['status'] = r.status;
        data['publishedAt'] = r.publishedAt ?? post.publishedAt;
      }
    }

    if (dto.slug && slugify(dto.slug) !== post.slug) {
      const base = slugify(dto.slug);
      const slug = await uniqueSlug(base, async (s) => {
        const hit = await this.prisma.post.findUnique({ where: { type_slug: { type, slug: s } } });
        return !!hit && hit.id !== id;
      });
      data['slug'] = slug;
      // Protect SEO: old public URL 301s to the new one (consumed by the web app).
      if (post.status === 'PUBLISHED') {
        await this.prisma.redirect.upsert({
          where: { fromPath: `/${post.slug}` },
          update: { toPath: `/${slug}` },
          create: { fromPath: `/${post.slug}`, toPath: `/${slug}` },
        });
      }
    }

    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        ...data,
        ...(dto.termIds
          ? { terms: { deleteMany: {}, create: dto.termIds.map((termId) => ({ termId })) } }
          : {}),
      },
      include: INCLUDE,
    });
    await this.recountTerms();
    return updated;
  }

  /** First delete moves to trash, deleting a trashed item removes it permanently. */
  async remove(id: string, user: AuthUser) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException();
    this.assertCanEdit(user, post);
    const c = caps(post.type as PostType);
    const canDelete = this.can(user, c['del']) &&
      (post.authorId === user.id || post.type === 'PAGE' || this.can(user, 'delete_others_posts'));
    if (!canDelete) throw new ForbiddenException();
    if (post.status !== 'TRASH') {
      await this.prisma.post.update({ where: { id }, data: { status: 'TRASH' } });
    } else {
      await this.prisma.post.delete({ where: { id } });
    }
    await this.recountTerms();
  }

  /** Keeps Term.postCount (published posts only) accurate for fast archives. */
  private async recountTerms() {
    await this.prisma.$executeRaw`
      UPDATE "Term" t SET "postCount" = COALESCE((
        SELECT COUNT(*) FROM "PostTerm" pt
        JOIN "Post" p ON p.id = pt."postId"
        WHERE pt."termId" = t.id AND p.status = 'PUBLISHED' AND p.type = 'POST'
      ), 0)`;
  }
}
