import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

const doc = (...paragraphs: string[]) => ({
  type: 'doc',
  content: paragraphs.map((text) => ({
    type: 'paragraph',
    content: [{ type: 'text', text }],
  })),
});

const html = (...paragraphs: string[]) =>
  paragraphs.map((p) => `<p>${p}</p>`).join('\n');

async function upsertUser(data: {
  username: string; email: string; displayName: string; slug: string;
  role: 'ADMINISTRATOR' | 'EDITOR' | 'AUTHOR' | 'CONTRIBUTOR' | 'SUBSCRIBER';
  password?: string;
}) {
  return prisma.user.upsert({
    where: { username: data.username },
    update: {},
    create: {
      username: data.username,
      email: data.email,
      displayName: data.displayName,
      slug: data.slug,
      role: data.role,
      passwordHash: await argon2.hash(data.password ?? 'admin12345'),
    },
  });
}

async function upsertTerm(taxonomy: 'CATEGORY' | 'TAG', name: string, description?: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return prisma.term.upsert({
    where: { taxonomy_slug: { taxonomy, slug } },
    update: {},
    create: { taxonomy, name, slug, description },
  });
}

async function upsertPost(data: {
  title: string; slug: string; body: string[]; authorId: string;
  termIds?: string[]; daysAgo?: number; type?: 'POST' | 'PAGE';
  excerpt?: string;
}) {
  const type = data.type ?? 'POST';
  const publishedAt = new Date(Date.now() - (data.daysAgo ?? 0) * 86_400_000);
  const post = await prisma.post.upsert({
    where: { type_slug: { type, slug: data.slug } },
    update: {},
    create: {
      type,
      status: 'PUBLISHED',
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt ?? data.body[0]?.slice(0, 160),
      content: doc(...data.body),
      contentHtml: html(...data.body),
      authorId: data.authorId,
      publishedAt,
    },
  });
  for (const termId of data.termIds ?? []) {
    await prisma.postTerm.upsert({
      where: { postId_termId: { postId: post.id, termId } },
      update: {},
      create: { postId: post.id, termId },
    });
  }
  return post;
}

async function main() {
  const adminPass = process.env['SEED_ADMIN_PASSWORD'] ?? 'admin12345';

  const admin = await upsertUser({
    username: 'admin', email: 'admin@example.com',
    displayName: 'Administrator', slug: 'admin', role: 'ADMINISTRATOR',
    password: adminPass,
  });
  const editor = await upsertUser({
    username: 'editor', email: 'editor@example.com',
    displayName: 'Elena Editor', slug: 'elena', role: 'EDITOR',
  });
  const author = await upsertUser({
    username: 'author', email: 'author@example.com',
    displayName: 'Arun Author', slug: 'arun', role: 'AUTHOR',
  });

  const options: Record<string, unknown> = {
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
  for (const [key, value] of Object.entries(options)) {
    await prisma.option.upsert({
      where: { key },
      update: {},
      create: { key, value: value as never },
    });
  }

  /* Taxonomies */
  const uncategorized = await upsertTerm('CATEGORY', 'Uncategorized');
  const news = await upsertTerm('CATEGORY', 'News', 'What is new in the project');
  const tutorials = await upsertTerm('CATEGORY', 'Tutorials', 'Step-by-step guides');
  const angular = await upsertTerm('TAG', 'Angular');
  const ssr = await upsertTerm('TAG', 'SSR');
  const seo = await upsertTerm('TAG', 'SEO');

  /* Posts */
  const welcome =
    'Welcome to your new site. Edit or delete this post, then start writing!';
  await upsertPost({
    title: 'Hello world!', slug: 'hello-world', body: [welcome],
    authorId: admin.id, termIds: [uncategorized.id], daysAgo: 10,
  });
  await upsertPost({
    title: ' WP Clone is running with full SSR ',
    slug: 'wp-clone-is-running-with-full-ssr',
    body: [
      'Every page of this site is rendered on the server, so search engines see complete HTML without executing a single line of JavaScript.',
      'The theme you are looking at is selected in wp-admin under Appearance, and its customizer settings are applied as CSS variables.',
      'Try switching themes or changing colors in the admin dashboard and reload this page.',
    ],
    authorId: admin.id, termIds: [news.id, angular.id, ssr.id], daysAgo: 7,
  });
  await upsertPost({
    title: 'How the theme system works',
    slug: 'how-the-theme-system-works',
    body: [
      'Themes are Angular component trees registered with the API. Switching the active theme changes which component renders the frontend.',
      'The customizer writes per-theme settings; the server merges them with defaults and ships them to the frontend in one bootstrap call.',
      'Because everything is server rendered, a theme change is visible to crawlers immediately.',
    ],
    authorId: editor.id, termIds: [tutorials.id, angular.id], daysAgo: 4,
  });
  await upsertPost({
    title: 'Chasing a 100 Lighthouse score',
    slug: 'chasing-a-100-lighthouse-score',
    body: [
      'Perfect Core Web Vitals come from a handful of disciplines: server rendering, no layout shifts, tiny CSS and images that are already the right size.',
      'This site serves responsive WebP images generated on upload, inlines critical theme CSS variables and streams the HTML from Express.',
      'Measure it yourself with Lighthouse on mobile: the SSR payload keeps LCP under control even on a throttled connection.',
    ],
    authorId: author.id, termIds: [tutorials.id, seo.id], daysAgo: 2,
  });

  /* Pages */
  const about = await upsertPost({
    title: 'About', slug: 'about', type: 'PAGE',
    body: ['This is an example page. It is different from a post because it lives in one place forever.'],
    authorId: admin.id,
  });
  await upsertPost({
    title: 'Contact', slug: 'contact', type: 'PAGE',
    body: ['Drop us a line at hello@example.com.'],
    authorId: admin.id,
  });

  /* Menus */
  const nav = await prisma.menu.upsert({
    where: { location: 'primary' },
    update: {},
    create: { name: 'Primary Menu', location: 'primary' },
  });
  await prisma.menuItem.deleteMany({ where: { menuId: nav.id } });
  const homeItem = await prisma.menuItem.create({
    data: { menuId: nav.id, label: 'Home', url: '/', order: 0 },
  });
  void homeItem;
  await prisma.menuItem.create({
    data: { menuId: nav.id, label: 'About', url: '/about/', order: 1 },
  });
  await prisma.menuItem.create({
    data: { menuId: nav.id, label: 'News', url: '/category/news/', order: 2 },
  });
  await prisma.menuItem.create({
    data: { menuId: nav.id, label: 'Tutorials', url: '/category/tutorials/', order: 3 },
  });
  await prisma.menuItem.create({
    data: { menuId: nav.id, label: 'Contact', url: '/contact/', order: 4 },
  });

  const footer = await prisma.menu.upsert({
    where: { location: 'footer' },
    update: {},
    create: { name: 'Footer Menu', location: 'footer' },
  });
  await prisma.menuItem.deleteMany({ where: { menuId: footer.id } });
  await prisma.menuItem.create({
    data: { menuId: footer.id, label: 'About', url: '/about/', order: 0 },
  });
  await prisma.menuItem.create({
    data: { menuId: footer.id, label: 'Contact', url: '/contact/', order: 1 },
  });

  void about;
  console.log('Seeded. Logins: admin /', adminPass, '· editor · author (same password)');
}

main().finally(() => prisma.$disconnect());
