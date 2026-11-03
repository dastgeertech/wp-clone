import {
  ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import type { MediaSummary } from '@wp-clone/shared-types';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';

/** Responsive widths generated for every upload (WordPress sizes). */
const WIDTHS = [320, 768, 1024, 1280, 1920];

export const UPLOAD_DIR =
  process.env['UPLOAD_DIR'] ?? join(process.cwd(), 'storage', 'uploads');

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
};

/**
 * Media library (wp-admin → Media). Every raster upload is re-encoded to
 * WebP at a set of responsive widths; originals are kept for downloads.
 */
@Injectable()
export class MediaService {
  constructor(private prisma: PrismaService) {}

  async upload(file: Express.Multer.File, uploaderId: string): Promise<MediaSummary> {
    const ext = EXT_BY_MIME[file.mimetype] ?? (extname(file.originalname) || '.bin');
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const base = `${Date.now()}-${id}`;
    await mkdir(UPLOAD_DIR, { recursive: true });

    const isRaster = file.mimetype !== 'image/svg+xml';
    let width: number | null = null;
    let height: number | null = null;
    const webp: Record<string, string> = {};

    if (isRaster) {
      const img = sharp(file.buffer, { failOn: 'none' });
      const meta = await img.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;

      for (const w of WIDTHS) {
        if (width && w > width) continue;
        const out = await img
          .clone()
          .resize({ width: w, withoutEnlargement: true })
          .webp({ quality: 78, effort: 4 })
          .toBuffer();
        const name = `${base}-${w}.webp`;
        await writeFile(join(UPLOAD_DIR, name), out);
        webp[String(w)] = `/uploads/${name}`;
      }
    }

    const originalName = `${base}${ext}`;
    await writeFile(join(UPLOAD_DIR, originalName), file.buffer);

    const row = await this.prisma.media.create({
      data: {
        uploaderId,
        filename: file.originalname || originalName,
        mimeType: file.mimetype,
        size: file.size,
        width, height,
        variants: {
          original: `/uploads/${originalName}`,
          webp,
        } as never,
      },
    });
    return this.toSummary(row);
  }

  async list(page = 1, perPage = 20, search?: string) {
    const where = search
      ? { filename: { contains: search, mode: 'insensitive' as const } }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.media.findMany({
        where, orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage, take: perPage,
      }),
      this.prisma.media.count({ where }),
    ]);
    return { items: items.map((m) => this.toSummary(m)), total, page, perPage };
  }

  async get(id: string) {
    const m = await this.prisma.media.findUnique({ where: { id } });
    if (!m) throw new NotFoundException();
    return this.toSummary(m);
  }

  async update(id: string, body: { altText?: string; caption?: string }) {
    await this.get(id);
    return this.prisma.media.update({
      where: { id },
      data: {
        ...(body.altText !== undefined ? { altText: body.altText } : {}),
        ...(body.caption !== undefined ? { caption: body.caption } : {}),
      },
    }).then((m) => this.toSummary(m));
  }

  /** Refuses when the image is still the featured image of a post. */
  async remove(id: string) {
    const m = await this.prisma.media.findUnique({
      where: { id },
      include: { featuredIn: { select: { id: true } } },
    });
    if (!m) throw new NotFoundException();
    if (m.featuredIn.length) {
      throw new ForbiddenException('Image is used as a featured image');
    }
    const variants = m.variants as { original?: string; webp?: Record<string, string> } | null;
    const paths = [
      variants?.original,
      ...Object.values(variants?.webp ?? {}),
    ].filter(Boolean) as string[];
    await this.prisma.media.delete({ where: { id } });
    for (const p of paths) {
      const name = p.replace(/^\/uploads\//, '');
      if (!name.includes('..')) {
        await rm(join(UPLOAD_DIR, name), { force: true }).catch(() => undefined);
      }
    }
  }

  private toSummary(m: {
    id: string; filename: string; mimeType: string; size: number;
    width: number | null; height: number | null;
    altText: string | null; caption: string | null; variants: unknown;
  }): MediaSummary {
    const variants = (m.variants ?? {}) as MediaSummary['variants'];
    return {
      id: m.id,
      url: variants.original ?? '',
      filename: m.filename,
      mimeType: m.mimeType,
      size: m.size,
      width: m.width,
      height: m.height,
      altText: m.altText,
      caption: m.caption,
      variants,
    };
  }
}
