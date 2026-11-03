import { HttpClient } from '@angular/common/http';
import { Injectable, RESPONSE_INIT, inject } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import type {
  AuthorSummary, CommentDto, Paged, PostDetail, PostSummary, TermSummary,
} from '@wp-clone/shared-types';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { PageState, RouteData } from './page-state';
import { SeoService } from './seo.service';
import { SiteService } from './site.service';
import { loadThemeComponent } from './theme-registry';

const API = environment.apiUrl;

const q = (params: Record<string, string | undefined>, extra: Record<string, string | undefined> = {}) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...extra })) {
    if (v !== undefined && v !== '') search.set(k, v);
  }
  const s = search.toString();
  return s ? `?${s}` : '';
};

/**
 * Resolves everything a theme needs BEFORE the view renders:
 * site bootstrap, page data, the active theme component and its SEO tags.
 * This is what makes the HTML complete on the server (100 SEO score).
 */
@Injectable()
export class ContentResolver implements Resolve<RouteData> {
  private http = inject(HttpClient);
  private site = inject(SiteService);
  private page = inject(PageState);
  private seo = inject(SeoService);
  /** Mutable response init provided by the SSR engine (null in the browser). */
  private responseInit = inject(RESPONSE_INIT, { optional: true }) as { status?: number } | null;

  async resolve(route: ActivatedRouteSnapshot): Promise<RouteData> {
    const site = await this.site.load();
    const path = route.url.map((u) => u.path).join('/');
    const page = Math.max(1, Number(route.queryParamMap.get('page')) || 1);

    const [data, themeComponent] = await Promise.all([
      this.fetchData(route, path, page),
      loadThemeComponent(site.theme.id),
    ]);

    this.page.site.set(site);
    this.page.data.set(data);
    this.page.themeComponent.set(themeComponent);
    this.seo.apply(data, site);

    if (data.kind === 'notfound') this.markNotFound();
    return data;
  }

  private async fetchData(
    route: ActivatedRouteSnapshot, path: string, page: number,
  ): Promise<RouteData> {
    if (route.routeConfig?.path === '**') return this.notFound(path);

    if (route.routeConfig?.path === '') {
      const home = await firstValueFrom(
        this.http.get<Paged<PostSummary> & { staticPage?: PostDetail }>(
          `${API}/content/home${q({ page: route.queryParamMap.get('page') ?? undefined })}`,
        ),
      );
      return { kind: 'home', posts: home, staticPage: home.staticPage };
    }

    switch (route.routeConfig?.path) {
      case 'search': {
        const term = route.queryParamMap.get('q') ?? '';
        if (!term) return { kind: 'search', q: '', posts: { items: [], total: 0, page: 1, perPage: 10 } };
        const posts = await firstValueFrom(
          this.http.get<Paged<PostSummary>>(`${API}/content/search${q({ q: term, page: String(page) })}`),
        );
        return { kind: 'search', q: term, posts };
      }
      case 'category/:slug':
      case 'tag/:slug': {
        const taxonomy = route.routeConfig.path.startsWith('category') ? 'CATEGORY' : 'TAG';
        const slug = route.paramMap.get('slug')!;
        const archive = await firstValueFrom(
          this.http.get<{ term: TermSummary } & Paged<PostSummary>>(
            `${API}/content/terms/${taxonomy}/${encodeURIComponent(slug)}${q({ page: String(page) })}`,
          ),
        );
        return { kind: 'archive', taxonomy, term: archive.term, posts: archive };
      }
      case 'author/:slug': {
        const slug = route.paramMap.get('slug')!;
        const archive = await firstValueFrom(
          this.http.get<{ author: AuthorSummary } & Paged<PostSummary>>(
            `${API}/content/authors/${encodeURIComponent(slug)}${q({ page: String(page) })}`,
          ),
        );
        return { kind: 'author', author: archive.author, posts: archive };
      }
      case ':slug': {
        const slug = route.paramMap.get('slug')!;
        const post = await this.tryFetch<PostDetail>(`${API}/content/posts/${encodeURIComponent(slug)}`);
        if (post) {
          const comments = await firstValueFrom(
            this.http.get<CommentDto[]>(`${API}/comments/post/${post.id}`),
          );
          return { kind: 'post', post, comments };
        }
        const pg = await this.tryFetch<PostDetail>(`${API}/content/pages/${encodeURIComponent(slug)}`);
        if (pg) return { kind: 'page', page: pg };
        return this.notFound(`/${slug}`);
      }
      default:
        return this.notFound(path ? `/${path}` : '/');
    }
  }

  private async tryFetch<T>(url: string): Promise<T | null> {
    try {
      return await firstValueFrom(this.http.get<T>(url));
    } catch (err) {
      if ((err as { status?: number })?.status === 404) return null;
      throw err;
    }
  }

  private notFound(path: string): RouteData {
    return { kind: 'notfound', path };
  }

  /** Tells the SSR engine to answer with a real HTTP 404. */
  private markNotFound() {
    if (this.responseInit) this.responseInit.status = 404;
  }
}
