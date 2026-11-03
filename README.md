# WP Clone — a WordPress clone on Angular SSR + NestJS + Prisma

A full-stack, production-shaped WordPress clone in an **Nx monorepo**:
server-rendered public site (100/100 Lighthouse SEO & mobile), a pixel-faithful
`wp-admin` panel, a real theme system with a customizer, and a WordPress-like
data model.

| Layer     | Tech |
|-----------|------|
| Monorepo  | Nx 24 |
| Public site | Angular 22 **SSR** (per-request rendering, `RenderMode.Server`) |
| Admin     | Angular 22 SPA (`wp-admin` clone) |
| API       | NestJS 12 (REST, `/api`) |
| Database  | PostgreSQL 17 · ORM: Prisma 7 |
| Auth      | JWT access + rotating refresh tokens (httpOnly cookie) + 5-role RBAC |
| UI        | Tailwind CSS v4 · Angular Material (admin dialogs/snackbars) |
| State     | Angular signals |
| Editor    | TipTap v3 (block editor, SSR-safe HTML rendering server-side) |
| Images    | sharp — automatic WebP + responsive widths on upload |

## Quick start

```bash
npm install
copy .env.example .env      # macOS/Linux: cp .env.example .env  — set real JWT secrets!
npm run setup:docker        # starts PostgreSQL + runs generate/migrate/seed
npm run dev                 # all three apps at once (api + web + admin)
# or individually:
npm run dev:api             # http://localhost:3333/api
npm run dev:web             # http://localhost:4200  (SSR public site)
npm run dev:admin           # http://localhost:4300  (wp-admin)
```

> **Node 24+ required** (`.nvmrc` = 24).
> Already have Postgres? Put its URL in `.env` (`DATABASE_URL`) and run `npm run setup` instead.

**Seeded logins** (password `admin12345`, override with `SEED_ADMIN_PASSWORD`):
`admin` (Administrator) · `editor` (Editor) · `author` (Author)

## Project layout

```
apps/
  api/                     NestJS 12 REST API (global prefix /api)
    prisma/                schema.prisma (WordPress-like model) + migrations + seed
    src/
      auth/                login, refresh rotation (reuse detection), logout, me
      users/               CRUD, role changes, reassignment on delete
      posts/               posts+pages: caps, scheduling, revisions, trash, slug 301s
      terms/               categories & tags (hierarchical)
      comments/            public submission (honeypot, moderation) + admin moderation
      media/               upload → sharp WebP variants (320/768/1024/1280/1920)
      menus/               nav menus with one nesting level
      options/             wp_options key/value store (in-memory cache)
      themes/              theme registry, activation, customizer settings
      content/             ★ public API consumed by the SSR site (bootstrap, posts, archives…)
      seo/                 XML sitemap + robots.txt
      common/              guards (JWT, capabilities), decorators (@Public, @RequireCapability)
  web/                     Angular 22 SSR public site
    src/app/core/          api client, SiteService (signals), SeoService (meta/OG/JSON-LD)
    src/app/ui/            responsive <picture> images, pagination, comments, menus
    src/app/themes/        classic · modern · minimal (each ships the whole frontend)
    src/server.ts          SSR server: /uploads proxy, /robots.txt, /sitemap.xml, 301s, caching
  admin/                   Angular 22 SPA — wp-admin clone (http://localhost:4300)
    src/app/core/          auth store, JWT interceptor + single-flight refresh, guards
    src/app/layout/        admin bar, sidebar (capability-aware), router outlet
    src/app/pages/         dashboard, posts list, post editor (TipTap), media, terms,
                           comments, appearance (themes/customizer/menus), users, settings
    src/app/shared/        pager, confirm dialog, media picker, TipTap editor widget
scripts/
  smoke.mjs                30-check API regression suite (npm run smoke)
  admin-e2e.mjs            headless-Edge CDP e2e for the admin SPA (npm run e2e:admin)
  screenshots.mjs          theme + wp-admin capture harness (npm run screenshots)
  lh-summary.mjs           prints Lighthouse scores/CWV from a JSON report
libs/
  shared-types/            roles + capability map + DTOs shared by all three apps
```

## Feature map (WordPress parity)

**Content** — posts & pages (TipTap blocks → JSON + rendered HTML), excerpts,
featured images, revisions on every content update, scheduling (auto-publish
every minute), trash → permanent delete, sticky posts, slug changes create 301s.

**Taxonomies** — categories (hierarchical) & tags, maintained `postCount`,
archives at `/category/:slug/`, `/tag/:slug/`.

**Comments** — threaded, guest + logged-in, honeypot spam trap, sitewide
"requires approval" option, per-post open/closed, moderation queue
(Approve/Unapprove/Spam/Trash) with reply-tree deletion.

**Users & roles** — Administrator · Editor · Author · Contributor · Subscriber,
capability-checked endpoints (`edit_posts`, `moderate_comments`, …), authors and
contributors only see/edit their own content; deleting a user reassigns content.

**Media** — upload (≤15 MB images), automatic WebP variants at responsive
widths, alt/caption editing, protected against deletion while used as featured
image; uploads stored in `storage/uploads` (configurable `UPLOAD_DIR`).

**Themes** — 3 built-in themes registered in the DB on boot:
- `classic` — warm single-column serif blog
- `modern` — dark hero + card grid
- `minimal` — magazine layout with sidebar

Each theme = one lazily-loaded Angular component tree that renders *every*
view (home, single, page, archives, author, search, 404). Switching the active
theme in **Appearance → Themes** swaps the entire frontend; only the active
theme's JS ships to the browser.

**Customizer** — per-theme `settingsSchema` drives the admin form (logo, colors,
fonts, layout width, hero, footer…). Settings persist per theme
(`ThemeSetting`), merge with defaults server-side and are applied as CSS
variables (`--wp-primary`, `--wp-accent`, `--wp-bg`, `--wp-text`, `--wp-font`, …).

**Settings** — General (title, tagline, site URL, language…), Writing (default
category), Reading (homepage = latest posts or a static page, posts per page),
Permalinks, SEO (title template, sitewide noindex).

## SEO & performance

- **Per-request SSR** for every public route — crawlers get complete HTML, no JS required.
- Canonical URLs, Open Graph, Twitter Cards, meta descriptions, `noindex` respect,
  and JSON-LD (`WebSite`+`SearchAction`, `BlogPosting`, `BreadcrumbList`).
- `/sitemap.xml` (posts, pages, categories, tags with `lastmod`) and `/robots.txt`
  generated from the DB and served by the SSR server.
- Slug renames answer **real HTTP 301s** (`Redirect` table) — link equity preserved.
  Both slash forms redirect (`/old` and `/old/` → `/new/`).
- **Trailing-slash canonicalization**: the permalink structure is `/%postname%/`,
  so `/hello-world` → **301** `/hello-world/` (only when content actually exists —
  verified via a cached `HEAD` probe against posts, pages, categories, tags and
  authors). `/search` is excluded by design; unknown paths 404 without redirecting.
- HTTP caching: `public, max-age=60, s-maxage=120, stale-while-revalidate=600`
  for HTML, 1-year immutable for hashed assets & uploads; gzip via `compression`.
- Angular HTTP transfer cache: API responses rendered on the server are
  serialized to the client → hydration never refetches.
- Route-level code splitting; themes and heavy admin screens lazy-load.
- Responsive `<picture>` images with explicit `width`/`height` + `aspect-ratio`
  placeholders (zero CLS); `fetchpriority="high"` on the LCP image.
- System fonts — no render-blocking font downloads.

**Verified**: Lighthouse on the production build (`nx build web` + `node dist/apps/web/server/server.mjs`)
scores **100 Performance · 100 Accessibility · 100 Best Practices · 100 SEO**
(LCP 0.7 s, CLS 0.002, TBT 30 ms, FCP 0.7 s). Reproduce with:

```bash
# serve the production artifact (dev server ships unminified bundles), then:
CHROME_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" \
  npx lighthouse http://localhost:4100/ --only-categories=performance,seo,accessibility,best-practices \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu" \
  --output=json --output-path=lighthouse-report.json --quiet
node scripts/lh-summary.mjs lighthouse-report.json
```

## API overview

Public (no auth): `GET /api/content/{bootstrap,home,posts,pages,terms,authors,search,redirect}`,
`GET /api/comments/post/:id`, `POST /api/comments`,
`GET /api/terms`, `GET /api/menus`, `GET /api/themes/active`, `GET /api/options/public`,
`GET /api/seo/{sitemap,robots}`

Bearer-token: `/api/auth/*` · `/api/posts` · `/api/users` · `/api/comments` ·
`/api/media` · `/api/terms` · `/api/menus` · `/api/options` · `/api/themes`

Protect a route with `@RequireCapability('edit_posts')`; mark open routes `@Public()`.

## Testing & verification

```bash
npm run smoke        # 30/30 API checks: auth, RBAC, posts, terms, comments,
                     # media (sharp), menus, options, themes, SEO, redirects, cleanup
npm run e2e:admin    # 27/27 admin SPA checks driven in headless Edge over CDP
npm run screenshots  # captures all 3 themes + 4 wp-admin screens to screenshots/
```

`npm run smoke` needs only the API (`nx serve api`) + Postgres.
`npm run e2e:admin` additionally needs `nx serve admin` (:4300) and Microsoft Edge
at the default path (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
override with `EDGE_PATH`). It launches a throwaway headless profile, then:

login → dashboard → all 9 admin screens → TipTap editor boot + typing →
permalink preview → save draft → title/content round-trip through the API →
featured-image dialog → trash → Trash view → permanent delete → session survives
reload → logout → logged-out guard (`/settings` → `/login`).

All scripts use Node built-ins only.

`npm run screenshots` switches the active theme through the API (asserting the
expected theme root actually rendered), shoots each theme's home + post pages,
restores the original theme, then logs into wp-admin and captures dashboard,
posts list, editor and customizer. It needs the same servers as `e2e:admin`
plus a running web server (:4100 production or :4200 dev) and disables the
browser cache first — HTML is `max-age=60`, otherwise you screenshot stale pages.

## Production notes

- Set strong `JWT_*` secrets and `NODE_ENV=production` (enables `Secure` cookies).
- The SSR server validates the `Host` header against a baked allow-list
  (`localhost`, `127.0.0.1` — see `security.allowedHosts` in
  `apps/web/project.json`). Add production domains at runtime with
  `NG_ALLOWED_HOSTS=www.example.com,example.com`, otherwise every request is
  rejected with `Header "host" … is not allowed`.
- **PostCSS config must be JSON**: `@angular/build` only loads
  `postcss.config.json` / `.postcssrc.json` — a `postcss.config.js` is *silently
  ignored*, which means Tailwind never compiles and you ship raw
  `@tailwind utilities;` with zero utility classes. The root
  `postcss.config.json` is wired into `nx.json` `sharedGlobals` so Nx's cache
  invalidates when it changes.
- Point `siteUrl` (Settings → General) at your public domain — it feeds canonical
  URLs, OG tags and the sitemap.
- `API_URL` (env) is the server-to-server API base used by the SSR server for
  sitemap/robots/redirects/uploads-proxying; keep it private.
- The web SSR server listens on `PORT` (default 4000). Admin is a static SPA —
  serve `dist/apps/admin/browser` behind the same origin and reverse-proxy `/api`.
- Docker images included for local Postgres 17 + Redis (Redis is optional infra).

## Versions

Angular 22.2 · NestJS 12 · Prisma 7.10 (v8 is still RC) · Nx 24 · Tailwind 4 · TipTap 3.
`@nx/nest` doesn't support NestJS 12 yet, so the API runs with
`@swc-node/register` + nodemon (keeps decorator metadata + the shared-types alias working).
