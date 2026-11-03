import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import type { PostDetail, SiteBootstrap } from '@wp-clone/shared-types';
import type { RouteData } from './page-state';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Per-route SEO: title/description, canonical, Open Graph, Twitter Cards
 * and JSON-LD structured data. Runs inside the route resolver, so every
 * value is present in the SSR HTML before the first byte is sent.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private doc = inject(DOCUMENT);

  apply(data: RouteData, site: SiteBootstrap): void {
    const opts = site.options;
    const base = (opts.siteUrl || 'http://localhost:4200').replace(/\/$/, '');
    const noindex = opts.seoNoIndexSite;

    // Keep <html lang> in sync with the site's language setting (a11y + SEO).
    this.doc.documentElement.lang = opts.language || 'en';

    let pageTitle = opts.siteTitle;
    let description = opts.tagline;
    let path = '/';
    let image: string | undefined;
    let ogType = 'website';
    let jsonLd: Record<string, unknown>[] = [];
    let robotsIndex = !noindex;
    let articleMeta: { published?: string; modified?: string; author?: string } = {};

    const breadcrumbs: [string, string][] = [['Home', '/']];

    switch (data.kind) {
      case 'home': {
        if (data.staticPage) {
          const p = data.staticPage;
          pageTitle = p.seoTitle || p.title;
          description = p.seoDescription || p.excerpt || opts.tagline;
          image = p.featuredImage?.url;
          jsonLd = [this.webSite(base, opts.siteTitle), this.breadcrumb(base, breadcrumbs)];
        } else {
          pageTitle = opts.tagline && opts.tagline !== opts.siteTitle
            ? `${opts.siteTitle} — ${opts.tagline}`
            : opts.siteTitle;
          jsonLd = [this.webSite(base, opts.siteTitle)];
        }
        break;
      }
      case 'post': {
        const p = data.post;
        pageTitle = p.seoTitle || p.title;
        description = p.seoDescription || p.excerpt || opts.tagline;
        path = p.url;
        image = p.featuredImage?.url;
        ogType = 'article';
        robotsIndex = !noindex && !p.noIndex;
        articleMeta = {
          published: p.publishedAt ?? undefined,
          modified: p.updatedAt,
          author: p.author.displayName,
        };
        for (const c of p.categories.slice(0, 1)) {
          breadcrumbs.push([c.name, `/category/${c.slug}/`]);
        }
        breadcrumbs.push([p.title, p.url]);
        jsonLd = [
          this.blogPosting(base, p, opts.siteTitle),
          this.breadcrumb(base, breadcrumbs),
        ];
        break;
      }
      case 'page': {
        const p = data.page;
        pageTitle = p.seoTitle || p.title;
        description = p.seoDescription || p.excerpt || opts.tagline;
        image = p.featuredImage?.url;
        robotsIndex = !noindex && !p.noIndex;
        breadcrumbs.push([p.title, p.url]);
        jsonLd = [this.breadcrumb(base, breadcrumbs)];
        break;
      }
      case 'archive': {
        const t = data.term;
        pageTitle = t.seoTitle || t.name;
        description =
          t.seoDescription ||
          t.description ||
          `All ${data.taxonomy === 'CATEGORY' ? 'posts in' : 'posts tagged'} ${t.name}`;
        path = `/${data.taxonomy === 'CATEGORY' ? 'category' : 'tag'}/${t.slug}/`;
        jsonLd = [
          this.collectionPage(base, t.name, path),
          this.breadcrumb(base, breadcrumbs),
        ];
        break;
      }
      case 'author': {
        const a = data.author;
        pageTitle = `${a.displayName} — Author`;
        description = a.bio || `Posts by ${a.displayName} at ${opts.siteTitle}`;
        path = `/author/${a.slug}/`;
        jsonLd = [
          {
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            name: a.displayName,
            url: `${base}${path}`,
          },
          this.breadcrumb(base, breadcrumbs),
        ];
        break;
      }
      case 'search': {
        pageTitle = `Search results for “${data.q}”`;
        description = `Search results for ${data.q} on ${opts.siteTitle}`;
        path = `/search?q=${encodeURIComponent(data.q)}`;
        robotsIndex = false; // search results are never indexed
        break;
      }
      case 'notfound': {
        pageTitle = `Page not found`;
        description = `The page you were looking for does not exist.`;
        path = data.path;
        robotsIndex = false;
        break;
      }
    }

    /* ---- title ---- */
    const fullTitle = data.kind === 'home' || data.kind === 'notfound'
      ? pageTitle
      : (opts.seoDefaultTitleTemplate || '%title% | %site%')
          .replace('%title%', pageTitle)
          .replace('%site%', opts.siteTitle);
    this.title.setTitle(fullTitle);

    /* ---- canonical + link relations ---- */
    const canonical = data.kind === 'post' && data.post.canonicalUrl
      ? data.post.canonicalUrl
      : `${base}${path.startsWith('/') ? path : `/${path}`}`;
    this.setLink('canonical', canonical);
    if (data.kind === 'search') this.setLink('search', `${base}/search?q=%query%`);

    /* ---- meta tags ---- */
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({
      name: 'robots',
      content: robotsIndex ? 'index, follow' : 'noindex, nofollow',
    });
    this.meta.updateTag({ property: 'og:site_name', content: opts.siteTitle });
    this.meta.updateTag({ property: 'og:locale', content: opts.language || 'en_US' });
    this.meta.updateTag({ property: 'og:type', content: ogType });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    if (image) this.meta.updateTag({ property: 'og:image', content: image });

    this.meta.updateTag({ name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    if (image) this.meta.updateTag({ name: 'twitter:image', content: image });

    if (articleMeta.published) {
      this.meta.updateTag({ property: 'article:published_time', content: articleMeta.published });
    }
    if (articleMeta.modified) {
      this.meta.updateTag({ property: 'article:modified_time', content: articleMeta.modified });
    }
    if (articleMeta.author) {
      this.meta.updateTag({ property: 'article:author', content: articleMeta.author });
    }

    /* ---- JSON-LD ---- */
    this.setJsonLd(jsonLd);
  }

  private setLink(rel: string, href: string) {
    let el = this.doc.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!el) {
      el = this.doc.createElement('link');
      el.setAttribute('rel', rel);
      this.doc.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  private setJsonLd(blocks: Record<string, unknown>[]) {
    let el = this.doc.getElementById('wp-json-ld') as HTMLScriptElement | null;
    if (!el) {
      el = this.doc.createElement('script');
      el.id = 'wp-json-ld';
      el.type = 'application/ld+json';
      this.doc.head.appendChild(el);
    }
    el.textContent = JSON.stringify(blocks).replace(/</g, '\\u003c');
  }

  private webSite(base: string, name: string) {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name,
      url: `${base}/`,
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${base}/search?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    };
  }

  private breadcrumb(base: string, items: [string, string][]) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map(([name, url], i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name,
        item: url.startsWith('http') ? url : `${base}${url}`,
      })),
    };
  }

  private collectionPage(base: string, name: string, path: string) {
    return {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name,
      url: `${base}${path}`,
    };
  }

  private blogPosting(base: string, p: PostDetail, siteName: string) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      mainEntityOfPage: `${base}${p.url}`,
      headline: p.seoTitle || p.title,
      description: p.seoDescription || p.excerpt || undefined,
      datePublished: p.publishedAt ?? undefined,
      dateModified: p.updatedAt,
      author: { '@type': 'Person', name: p.author.displayName, url: `${base}/author/${p.author.slug}/` },
      publisher: {
        '@type': 'Organization',
        name: siteName,
        ...(p.featuredImage?.url ? { logo: { '@type': 'ImageObject', url: p.featuredImage.url } } : {}),
      },
      ...(p.featuredImage?.url
        ? { image: [p.featuredImage.url] }
        : {}),
      articleSection: p.categories[0]?.name,
      wordCount: p.contentHtml.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length,
    };
  }
}
