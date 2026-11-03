import { Injectable } from '@nestjs/common';
import { PublicOptions } from '@wp-clone/shared-types';
import { PrismaService } from '../prisma/prisma.service';

/** Mirrors prisma/seed.ts — shown even before the first save. */
export const DEFAULT_OPTIONS: Record<string, unknown> = {
  siteTitle: 'My WP Clone',
  tagline: 'Just another Angular-powered site',
  siteUrl: 'http://localhost:4200',
  language: 'en',
  postsPerPage: 10,
  homepageDisplays: 'posts',
  homepageId: null,
  permalinkStructure: '/%postname%/',
  defaultCommentStatus: 'OPEN',
  commentsRequireApproval: true,
  seoDefaultTitleTemplate: '%title% | %site%',
  seoNoIndexSite: false,
  dateFormat: 'F j, Y',
  timeFormat: 'g:i a',
  startOfWeek: 1,
  adminEmail: 'admin@example.com',
};

const PUBLIC_KEYS: (keyof PublicOptions)[] = [
  'siteTitle',
  'tagline',
  'siteUrl',
  'language',
  'postsPerPage',
  'homepageDisplays',
  'homepageId',
  'defaultCommentStatus',
  'commentsRequireApproval',
  'seoDefaultTitleTemplate',
  'seoNoIndexSite',
];

/**
 * Key/value settings (wp_options). Whole table is cached in memory and
 * invalidated on write — reads happen on every SSR request.
 */
@Injectable()
export class OptionsService {
  private cache: Map<string, unknown> | null = null;

  constructor(private prisma: PrismaService) {}

  async all(): Promise<Record<string, unknown>> {
    if (!this.cache) {
      const rows = await this.prisma.option.findMany();
      this.cache = new Map(rows.map((r) => [r.key, r.value as unknown]));
    }
    const out: Record<string, unknown> = { ...DEFAULT_OPTIONS };
    for (const [k, v] of this.cache) out[k] = v;
    return out;
  }

  async get<T = unknown>(key: string): Promise<T> {
    return (await this.all())[key] as T;
  }

  /** The subset the public site is allowed to see. */
  async publicOptions(): Promise<PublicOptions> {
    const all = await this.all();
    const out = {} as Record<string, unknown>;
    for (const k of PUBLIC_KEYS) out[k] = all[k];
    return out as unknown as PublicOptions;
  }

  async set(entries: Record<string, unknown>): Promise<Record<string, unknown>> {
    for (const [key, value] of Object.entries(entries)) {
      await this.prisma.option.upsert({
        where: { key },
        update: { value: value as never },
        create: { key, value: value as never },
      });
    }
    this.cache = null;
    return this.all();
  }
}
