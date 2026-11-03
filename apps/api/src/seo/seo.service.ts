import { Injectable } from '@nestjs/common';
import { OptionsService } from '../options/options.service';
import { PrismaService } from '../prisma/prisma.service';

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

/**
 * XML sitemap + robots.txt (wp-admin → Settings → Reading / SEO).
 * Served by the web SSR server at /sitemap.xml and /robots.txt.
 */
@Injectable()
export class SeoService {
  constructor(private prisma: PrismaService, private options: OptionsService) {}

  async sitemap(): Promise<string> {
    const opts = await this.options.publicOptions();
    const base = (opts.siteUrl || 'http://localhost:4200').replace(/\/$/, '');

    const [posts, pages, categories, tags] = await Promise.all([
      this.prisma.post.findMany({
        where: { type: 'POST', status: 'PUBLISHED' },
        select: { slug: true, updatedAt: true },
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.post.findMany({
        where: { type: 'PAGE', status: 'PUBLISHED' },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.term.findMany({
        where: { taxonomy: 'CATEGORY', postCount: { gt: 0 } },
        select: { slug: true },
      }),
      this.prisma.term.findMany({
        where: { taxonomy: 'TAG', postCount: { gt: 0 } },
        select: { slug: true },
      }),
    ]);

    const url = (loc: string, lastmod?: Date | null) => `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>${loc === `${base}/` ? '1.0' : '0.7'}</priority>
  </url>`;

    const parts = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      url(`${base}/`),
      ...pages.map((p) => url(`${base}/${p.slug}/`, p.updatedAt)),
      ...posts.map((p) => url(`${base}/${p.slug}/`, p.updatedAt)),
      ...categories.map((c) => url(`${base}/category/${c.slug}/`)),
      ...tags.map((t) => url(`${base}/tag/${t.slug}/`)),
      '</urlset>',
    ];
    return parts.join('\n');
  }

  async robots(): Promise<string> {
    const opts = await this.options.publicOptions();
    const base = (opts.siteUrl || 'http://localhost:4200').replace(/\/$/, '');
    const noindex = opts.seoNoIndexSite;
    const lines = [
      'User-agent: *',
      ...(noindex ? ['Disallow: /'] : ['Allow: /', 'Disallow: /api/', 'Disallow: /uploads/']),
      `Sitemap: ${base}/sitemap.xml`,
    ];
    return lines.join('\n') + '\n';
  }
}
