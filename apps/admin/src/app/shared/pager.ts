import { Component, computed, input, output } from '@angular/core';

/** wp-admin list-table pager (Prev / numbered pages / Next). */
@Component({
  selector: 'wp-pager',
  template: `
    @if (totalPages() > 1) {
      <nav class="flex items-center gap-1 pt-4" aria-label="Pagination">
        <button
          type="button"
          class="wp-btn"
          [disabled]="page() <= 1"
          (click)="pageChange.emit(page() - 1)"
        >
          « Previous
        </button>
        @for (p of pages(); track p) {
          @if (p === null) {
            <span class="px-1.5 text-wp-muted">…</span>
          } @else if (p === page()) {
            <span
              class="min-w-8 h-8 px-2 grid place-items-center rounded border border-wp-border bg-wp-blue text-white"
              aria-current="page"
            >
              {{ p }}
            </span>
          } @else {
            <button type="button" class="wp-btn min-w-8 h-8 px-2" (click)="pageChange.emit(p)">
              {{ p }}
            </button>
          }
        }
        <button
          type="button"
          class="wp-btn"
          [disabled]="page() >= totalPages()"
          (click)="pageChange.emit(page() + 1)"
        >
          Next »
        </button>
      </nav>
    }
  `,
})
export class PagerComponent {
  page = input(1);
  total = input(0);
  perPage = input(20);
  pageChange = output<number>();

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.perPage()))),
  );

  pages = computed<(number | null)[]>(() => {
    const cur = this.page();
    const last = this.totalPages();
    const out: (number | null)[] = [];
    for (let i = 1; i <= last; i++) {
      if (i === 1 || i === last || Math.abs(i - cur) <= 2) out.push(i);
      else if (out[out.length - 1] !== null) out.push(null);
    }
    return out;
  });
}
