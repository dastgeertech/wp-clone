import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminComment, CommentStatusName, Paged } from '@wp-clone/shared-types';
import { Api } from '../core/api';
import { Notify } from '../core/notify';
import { Confirm } from '../shared/confirm';
import { formatDateTime } from '../shared/format';
import { PagerComponent } from '../shared/pager';

const VIEWS: { label: string; status: string }[] = [
  { label: 'All', status: '' },
  { label: 'Pending', status: 'PENDING' },
  { label: 'Approved', status: 'APPROVED' },
  { label: 'Spam', status: 'SPAM' },
  { label: 'Trash', status: 'TRASH' },
];

@Component({
  selector: 'wp-comments-page',
  imports: [FormsModule, RouterLink, PagerComponent],
  template: `
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <h1 class="mb-0">Comments</h1>
      <form class="ml-auto flex gap-2" (ngSubmit)="search(qInput.value)">
        <input #qInput class="wp-input w-44" placeholder="Search…" [value]="q()" aria-label="Search comments" />
        <button class="wp-btn" type="submit">Search</button>
      </form>
    </div>

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
            (click)="setView(v.status)"
          >
            {{ v.label }}
          </button>
        </li>
      }
    </ul>

    @if (loading()) {
      <p class="py-10 text-center text-wp-muted">Loading…</p>
    } @else if (rows().length === 0) {
      <div class="wp-box p-10 text-center text-wp-muted">No comments found.</div>
    } @else {
      <div class="wp-box overflow-x-auto">
        <table class="wp-table">
          <thead>
            <tr>
              <th>Author</th>
              <th>Comment</th>
              <th class="hidden md:table-cell">Date</th>
              <th class="hidden sm:table-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (c of rows(); track c.id) {
              <tr>
                <td class="min-w-36">
                  <div class="font-semibold text-wp-ink">{{ c.authorName }}</div>
                  <a class="text-wp-sm break-all" [href]="'mailto:' + c.authorEmail">{{ c.authorEmail }}</a>
                  @if (c.authorUrl) {
                    <div class="text-wp-sm"><a [href]="c.authorUrl" target="_blank" rel="noopener nofollow">{{ c.authorUrl }}</a></div>
                  }
                  <span class="wp-pill" [class]="'wp-pill-' + pillClass(c.status)">{{ label(c.status) }}</span>
                </td>
                <td class="min-w-64">
                  <p class="text-wp whitespace-pre-line">{{ c.content }}</p>
                  @if (c.post; as p) {
                    <div class="mt-1 text-wp-sm text-wp-muted">
                      on
                      <a [routerLink]="p.type === 'PAGE' ? ['/pages', p.id] : ['/posts', p.id]">{{ p.title }}</a>
                    </div>
                  }
                </td>
                <td class="hidden md:table-cell text-wp whitespace-nowrap">{{ formatDateTime(c.createdAt) }}</td>
                <td class="hidden sm:table-cell whitespace-nowrap">
                  <div class="flex flex-col items-start gap-1">
                    @if (c.status !== 'APPROVED') {
                      <button type="button" class="wp-btn-plain wp-btn" (click)="setStatus(c.id, 'APPROVED')">Approve</button>
                    }
                    @if (c.status === 'APPROVED') {
                      <button type="button" class="wp-btn-plain wp-btn" (click)="setStatus(c.id, 'PENDING')">Unapprove</button>
                    }
                    @if (c.status !== 'SPAM' && c.status !== 'TRASH') {
                      <button type="button" class="wp-btn-plain wp-btn" (click)="setStatus(c.id, 'SPAM')">Mark as Spam</button>
                    }
                    @if (c.status !== 'TRASH') {
                      <button type="button" class="wp-btn-plain wp-btn" (click)="setStatus(c.id, 'TRASH')">Trash</button>
                    } @else {
                      <button type="button" class="wp-btn-plain wp-btn" (click)="setStatus(c.id, 'APPROVED')">Restore</button>
                      <button type="button" class="wp-btn-plain wp-btn !text-wp-red" (click)="destroy(c)">Delete Permanently</button>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <wp-pager [page]="page()" [total]="total()" [perPage]="20" (pageChange)="setPage($event)" />
    }
  `,
})
export class CommentsPage implements OnDestroy {
  private api = inject(Api);
  private notify = inject(Notify);
  private confirm = inject(Confirm);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly views = VIEWS;
  readonly formatDateTime = formatDateTime;

  readonly rows = signal<AdminComment[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly status = signal('');
  readonly q = signal('');

  private sub = { unsubscribe: () => undefined as void };

  constructor() {
    this.sub = this.route.queryParamMap.subscribe((params) => {
      this.status.set(params.get('status') ?? '');
      this.q.set(params.get('q') ?? '');
      this.load(Number(params.get('page') ?? 1) || 1);
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  label(s: CommentStatusName): string {
    return { PENDING: 'Pending', APPROVED: 'Approved', SPAM: 'Spam', TRASH: 'Trash' }[s];
  }

  pillClass(s: CommentStatusName): string {
    return { PENDING: 'pending', APPROVED: 'published', SPAM: 'draft', TRASH: 'trash' }[s];
  }

  setView(status: string): void {
    this.goto({ status: status || null, page: null });
  }

  search(term: string): void {
    this.goto({ q: term.trim() || null, page: null });
  }

  setPage(page: number): void {
    this.goto({ page: page > 1 ? String(page) : null });
  }

  setStatus(id: string, status: CommentStatusName): void {
    this.api.patch(`/comments/${id}`, { status }).subscribe({
      next: () => {
        this.notify.ok(`Comment ${this.label(status).toLowerCase()}`);
        this.load(this.page());
      },
      error: (err: unknown) => this.notify.error(err),
    });
  }

  async destroy(c: AdminComment): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete comment permanently?',
      message: `The comment from ${c.authorName} will be deleted for good.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.api.delete(`/comments/${c.id}`).subscribe({
      next: () => {
        this.notify.ok('Comment deleted');
        this.load(this.page());
      },
      error: (err: unknown) => this.notify.error(err),
    });
  }

  private load(page: number): void {
    this.loading.set(true);
    this.api
      .get<Paged<AdminComment>>('/comments', {
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
