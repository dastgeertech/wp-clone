import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { AdminPostSummary, Paged, PostStatusName } from '@wp-clone/shared-types';
import { Api } from '../core/api';
import { Confirm } from '../shared/confirm';
import { Notify } from '../core/notify';
import { environment } from '../../environments/environment';
import { formatDate, humanize } from '../shared/format';
import { PagerComponent } from '../shared/pager';

const VIEWS: { label: string; status: string }[] = [
  { label: 'All', status: '' },
  { label: 'Published', status: 'PUBLISHED' },
  { label: 'Draft', status: 'DRAFT' },
  { label: 'Pending', status: 'PENDING' },
  { label: 'Scheduled', status: 'SCHEDULED' },
  { label: 'Trash', status: 'TRASH' },
];

@Component({
  selector: 'wp-posts-list',
  imports: [RouterLink, PagerComponent],
  template: `
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <h1 class="mb-0">{{ type() === 'PAGE' ? 'Pages' : 'Posts' }}</h1>
      <a class="wp-btn" [routerLink]="type() === 'PAGE' ? '/pages/new' : '/posts/new'">
        + Add New
      </a>
      <form class="ml-auto flex gap-2" (ngSubmit)="search(qInput.value)">
        <input
          #qInput
          class="wp-input w-44"
          placeholder="Search…"
          [value]="q()"
          aria-label="Search"
        />
        <button class="wp-btn" type="submit">Search</button>
      </form>
    </div>

    <!-- views -->
    <ul class="mb-3 flex flex-wrap gap-1 border-b border-wp-border text-wp">
      @for (v of views; track v.status) {
        <li>
          <button
            type="button"
            class="px-3 py-1.5 rounded-t border border-transparent"
            [class.bg-white]="v.status === status()"
            [class.border-wp-border]="v.status === status()"
            [class.border-b-white]="v.status === status()"
            [class.font-semibold]="v.status === status()"
            [class.text-wp-blue]="v.status === status()"
            (click)="setStatus(v.status)"
          >
            {{ v.label }}
          </button>
        </li>
      }
      @if (q()) {
        <li class="ml-auto self-center text-wp-muted">
          Search results for “{{ q() }}”
          <button type="button" class="wp-btn-plain wp-btn" (click)="search('')">×</button>
        </li>
      }
    </ul>

    @if (loading()) {
      <p class="text-wp-muted py-8 text-center">Loading…</p>
    } @else if (rows().length === 0) {
      <div class="wp-box p-8 text-center text-wp text-wp-muted">
        No {{ type() === 'PAGE' ? 'pages' : 'posts' }} found.
        <a [routerLink]="type() === 'PAGE' ? '/pages/new' : '/posts/new'">Create one</a>.
      </div>
    } @else {
      <div class="wp-box overflow-x-auto">
        <table class="wp-table">
          <thead>
            <tr>
              <th>Title</th>
              @if (type() === 'POST') {
                <th class="hidden md:table-cell">Categories</th>
                <th class="hidden lg:table-cell">Tags</th>
              }
              <th class="hidden sm:table-cell">Author</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            @for (p of rows(); track p.id) {
              <tr>
                <td class="min-w-52">
                  <a
                    class="font-semibold text-wp-ink text-wp-lg hover:text-wp-blue"
                    [routerLink]="type() === 'PAGE' ? ['/pages', p.id] : ['/posts', p.id]"
                  >
                    {{ p.title }}
                  </a>
                  <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-wp-sm text-wp-muted">
                    <span class="wp-pill" [class]="'wp-pill-' + p.status.toLowerCase()">
                      {{ humanize(p.status) }}
                    </span>
                    @if (p.status === 'PUBLISHED') {
                      <a [href]="env.siteUrl + '/' + p.slug + '/'" target="_blank" rel="noopener">View</a>
                    }
                    <button type="button" class="wp-btn-plain wp-btn" (click)="edit(p)">Edit</button>
                    @if (p.status === 'TRASH') {
                      <button type="button" class="wp-btn-plain wp-btn" (click)="restore(p)">Restore</button>
                      <button type="button" class="wp-btn-plain wp-btn !text-wp-red" (click)="destroy(p)">
                        Delete Permanently
                      </button>
                    } @else {
                      <button type="button" class="wp-btn-plain wp-btn" (click)="trash(p)">Trash</button>
                    }
                  </div>
                </td>
                @if (type() === 'POST') {
                  <td class="hidden md:table-cell text-wp">
                    {{ termNames(p, 'CATEGORY') || '—' }}
                  </td>
                  <td class="hidden lg:table-cell text-wp">
                    {{ termNames(p, 'TAG') || '—' }}
                  </td>
                }
                <td class="hidden sm:table-cell text-wp">{{ p.author.displayName }}</td>
                <td class="text-wp whitespace-nowrap">
                  {{ formatDate(p.publishedAt ?? p.updatedAt) }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <wp-pager
        [page]="page()"
        [total]="total()"
        [perPage]="20"
        (pageChange)="setPage($event)"
      />
    }
  `,
})
export class PostsListPage implements OnDestroy {
  readonly type = signal<'POST' | 'PAGE'>('POST');
  readonly env = environment;
  readonly views = VIEWS;
  readonly humanize = humanize;
  readonly formatDate = formatDate;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(Api);
  private confirm = inject(Confirm);
  private notify = inject(Notify);

  readonly loading = signal(true);
  readonly rows = signal<AdminPostSummary[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly status = signal('');
  readonly q = signal('');

  private sub?: Subscription;

  constructor() {
    // `data.type` from the route config (available on the snapshot immediately).
    this.type.set(this.route.snapshot.data['type'] === 'PAGE' ? 'PAGE' : 'POST');
    this.route.queryParamMap.subscribe((params) => {
      this.status.set(params.get('status') ?? '');
      this.q.set(params.get('q') ?? '');
      const page = Number(params.get('page') ?? 1) || 1;
      this.load(page);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  setStatus(status: string): void {
    this.goto({ status: status || null, page: null });
  }

  search(term: string): void {
    this.goto({ q: term.trim() || null, page: null });
  }

  setPage(page: number): void {
    this.goto({ page: page > 1 ? String(page) : null });
  }

  termNames(p: AdminPostSummary, taxonomy: 'CATEGORY' | 'TAG'): string {
    return p.terms
      .filter((t) => t.term.taxonomy === taxonomy)
      .map((t) => t.term.name)
      .join(', ');
  }

  edit(p: AdminPostSummary): void {
    this.router.navigate([this.type() === 'PAGE' ? '/pages' : '/posts', p.id]);
  }

  async trash(p: AdminPostSummary): Promise<void> {
    if (!(await this.confirm.ask({ title: 'Move to Trash?', message: `“${p.title}” will be moved to the trash.` }))) return;
    this.mutate(() => this.api.patch(`/posts/${p.id}`, { status: 'TRASH' }), 'Post moved to trash.');
  }

  async restore(p: AdminPostSummary): Promise<void> {
    const status: PostStatusName = p.publishedAt ? 'PUBLISHED' : 'DRAFT';
    this.mutate(() => this.api.patch(`/posts/${p.id}`, { status }), 'Post restored.');
  }

  async destroy(p: AdminPostSummary): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete permanently?',
      message: `“${p.title}” will be deleted for good. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.mutate(() => this.api.delete(`/posts/${p.id}`), 'Post deleted.');
  }

  private mutate(op: () => Observable<unknown>, done: string): void {
    op().subscribe({
      next: () => {
        this.notify.ok(done);
        this.load(this.page());
      },
      error: (err: unknown) => this.notify.error(err),
    });
  }

  private load(page: number): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.sub = this.api
      .get<Paged<AdminPostSummary>>('/posts', {
        type: this.type(),
        status: this.status() || undefined,
        search: this.q() || undefined,
        page,
        perPage: 20,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.items);
          this.total.set(res.total);
          this.page.set(res.page);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.notify.error(err);
          this.loading.set(false);
        },
      });
  }

  private goto(changes: Record<string, string | null>): void {
    const current = this.route.snapshot.queryParamMap;
    const next: Record<string, string> = {};
    for (const key of current.keys) next[key] = current.get(key) ?? '';
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) delete next[key];
      else next[key] = value;
    }
    this.router.navigate([], { relativeTo: this.route, queryParams: next });
  }
}
