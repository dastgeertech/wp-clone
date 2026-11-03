import {
  BadRequestException, ForbiddenException, Injectable,
  NotFoundException, PayloadTooLargeException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { CommentDto, CommentStatusName } from '@wp-clone/shared-types';
import { OptionsService } from '../options/options.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/comment.dto';

type CommentRow = {
  id: string; parentId: string | null; authorName: string; authorUrl: string | null;
  content: string; createdAt: Date;
  user: { id: string; displayName: string; slug: string; bio: string | null;
    avatar: { variants: unknown } | null } | null;
  replies: CommentRow[];
};

const AUTHOR_SELECT = {
  id: true, displayName: true, slug: true, bio: true,
  avatar: { select: { variants: true } },
} as const;

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService, private options: OptionsService) {}

  /* ------------------------------ public ------------------------------ */

  /** Approved comments of a post, threaded. */
  async approvedForPost(postId: string): Promise<CommentDto[]> {
    const rows = await this.prisma.comment.findMany({
      where: { postId, status: 'APPROVED' },
      include: { user: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
    return this.thread(rows as unknown as CommentRow[]);
  }

  /**
   * Public submission. Honours the honeypot, the site-wide moderation
   * option and the per-post "comments open" switch (WordPress behaviour).
   */
  async create(dto: CreateCommentDto, ip: string, userId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: dto.postId },
      select: { id: true, status: true, commentStatus: true, type: true },
    });
    if (!post || post.status !== 'PUBLISHED') throw new NotFoundException('Post not found');
    if (post.commentStatus === 'CLOSED') throw new ForbiddenException('Comments are closed');
    if (dto.content.length > 5000) throw new PayloadTooLargeException();
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.postId !== dto.postId) throw new BadRequestException('Invalid parent comment');
    }
    if (dto.website?.trim()) {
      // Honeypot triggered: accept silently but mark as spam.
      await this.prisma.comment.create({
        data: this.rowData(dto, ip, 'SPAM', userId),
      });
      return { status: 'spam' as const };
    }
    const approve = userId || !(await this.options.get<boolean>('commentsRequireApproval'));
    const row = await this.prisma.comment.create({
      data: this.rowData(dto, ip, approve ? 'APPROVED' : 'PENDING', userId),
    });
    return { status: approve ? ('approved' as const) : ('pending' as const), id: row.id };
  }

  private rowData(
    dto: CreateCommentDto, ip: string, status: CommentStatusName, userId?: string,
  ) {
    return {
      postId: dto.postId,
      parentId: dto.parentId,
      authorName: dto.authorName.trim(),
      authorEmail: dto.authorEmail.toLowerCase(),
      authorUrl: dto.authorUrl,
      content: dto.content.trim(),
      status,
      userId,
      // Salted hash — no raw IPs at rest.
      ipHash: createHash('sha256')
        .update(`${process.env['JWT_ACCESS_SECRET'] ?? ''}${ip}`)
        .digest('hex'),
    };
  }

  private thread(rows: CommentRow[]): CommentDto[] {
    const byParent = new Map<string | null, CommentRow[]>();
    for (const r of rows) {
      const list = byParent.get(r.parentId) ?? [];
      list.push(r);
      byParent.set(r.parentId, list);
    }
    const build = (parent: string | null): CommentDto[] =>
      (byParent.get(parent) ?? []).map((r) => ({
        id: r.id,
        parentId: r.parentId,
        authorName: r.authorName,
        authorUrl: r.authorUrl,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        author: r.user
          ? { id: r.user.id, displayName: r.user.displayName, slug: r.user.slug, bio: r.user.bio }
          : null,
        replies: build(r.id),
      }));
    return build(null);
  }

  /* ------------------------------ admin ------------------------------ */

  async list(q: { status?: CommentStatusName; postId?: string; search?: string; page?: number; perPage?: number }) {
    const page = q.page ?? 1, perPage = q.perPage ?? 20;
    const where: Record<string, unknown> = {
      ...(q.status ? { status: q.status } : { status: { not: 'TRASH' } }),
      ...(q.postId ? { postId: q.postId } : {}),
      ...(q.search
        ? { OR: [
            { content: { contains: q.search, mode: 'insensitive' } },
            { authorName: { contains: q.search, mode: 'insensitive' } },
          ] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        include: {
          post: { select: { id: true, title: true, slug: true, type: true } },
          user: { select: AUTHOR_SELECT },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage, take: perPage,
      }),
      this.prisma.comment.count({ where }),
    ]);
    return { items, total, page, perPage };
  }

  async setStatus(id: string, status: CommentStatusName) {
    const c = await this.prisma.comment.findUnique({ where: { id } });
    if (!c) throw new NotFoundException();
    await this.prisma.comment.update({ where: { id }, data: { status } });
  }

  /** Deleting a comment also removes its replies (WordPress moves the tree). */
  async remove(id: string) {
    const c = await this.prisma.comment.findUnique({ where: { id } });
    if (!c) throw new NotFoundException();
    const ids = await this.collectIds(id);
    await this.prisma.comment.deleteMany({ where: { id: { in: ids } } });
  }

  private async collectIds(id: string): Promise<string[]> {
    const kids = await this.prisma.comment.findMany({
      where: { parentId: id }, select: { id: true },
    });
    const out = [id];
    for (const k of kids) out.push(...(await this.collectIds(k.id)));
    return out;
  }

  async countByStatus(): Promise<Record<CommentStatusName, number>> {
    const rows = await this.prisma.comment.groupBy({
      by: ['status'], _count: { _all: true },
    });
    const out: Record<string, number> = { PENDING: 0, APPROVED: 0, SPAM: 0, TRASH: 0 };
    for (const r of rows) out[r.status] = r._count._all;
    return out as Record<CommentStatusName, number>;
  }
}
