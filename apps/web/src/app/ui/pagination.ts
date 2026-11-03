import { Component, computed, input } from '@angular/core';

/** WordPress-style pagination with crawlable `?page=n` links. */
@Component({
  selector: 'wp-pagination',
  template: `
    @if (pages().length > 1) {
      <nav class="flex items-center justify-center gap-1 py-8" aria-label="Pagination">
        @if (page() > 1) {
          <a class="wp-page-link" [href]="href(page() - 1)" rel="prev">← Newer</a>
        }
        @for (p of pages(); track p) {
          @if (p === null) {
            <span class="px-2 opacity-50">…</span>
          } @else if (p === page()) {
            <span aria-current="page"
                  class="min-w-9 h-9 px-3 grid place-items-center rounded-full font-semibold"
                  style="background: var(--wp-accent); color: #fff">{{ p }}</span>
          } @else {
            <a class="wp-page-link" [href]="href(p)">{{ p }}</a>
          }
        }
        @if (page() < totalPages()) {
          <a class="wp-page-link" [href]="href(page() + 1)" rel="next">Older →</a>
        }
      </nav>
    }
  `,
  styles: `
    .wp-page-link {
      min-width: 2.25rem; height: 2.25rem; padding: 0 0.6rem;
      display: grid; place-items: center; border-radius: 9999px;
      color: var(--wp-text); text-decoration: none; font-weight: 500;
    }
    .wp-page-link:hover { background: color-mix(in srgb, var(--wp-accent) 14%, transparent); color: var(--wp-accent); }
  `,
})
export class PaginationComponent {
  page = input(1);
  total = input(0);
  perPage = input(10);
  /** Path the links point at, e.g. `/` or `/category/news`. */
  basePath = input('/');
  /** Extra query string (e.g. `q=angular`) that must be preserved. */
  query = input('');

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.perPage()))),
  );

  /** Page numbers to render; `null` marks an ellipsis gap. */
  pages = computed<(number | null)[]>(() => {
    const cur = this.page(), last = this.totalPages();
    const out: (number | null)[] = [];
    for (let i = 1; i <= last; i++) {
      if (i === 1 || i === last || Math.abs(i - cur) <= 2) out.push(i);
      else if (out[out.length - 1] !== null) out.push(null);
    }
    return out;
  });

  href(p: number): string {
    const params = new URLSearchParams(this.query() || undefined);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    const base = this.basePath().replace(/\/$/, '');
    return `${base || '/'}${qs ? `?${qs}` : ''}`;
  }
}
