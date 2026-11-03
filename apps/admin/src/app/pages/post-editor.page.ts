import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Subscription } from 'rxjs';
import {
  AdminPostDetail,
  AdminPostSummary,
  MediaSummary,
  Paged,
  PostStatusName,
  TermSummary,
} from '@wp-clone/shared-types';
import { Api } from '../core/api';
import { Notify } from '../core/notify';
import { Confirm } from '../shared/confirm';
import { MediaPickerDialog } from '../shared/media-picker';
import { TiptapEditorComponent } from '../shared/tiptap';
import { MatDialog } from '@angular/material/dialog';
import { environment } from '../../environments/environment';
import { fromLocalInput, toLocalInput } from '../shared/format';

const EMPTY_DOC: Record<string, unknown> = { type: 'doc', content: [] };

/** Mirrors apps/api/src/common/util/slug.ts for the permalink preview. */
function slugify(input: string): string {
  const s = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return s || 'untitled';
}

@Component({
  selector: 'wp-post-editor',
  imports: [FormsModule, RouterLink, TiptapEditorComponent],
  template: `
    <!-- header -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <a [routerLink]="type === 'PAGE' ? '/pages' : '/posts'">← All {{ type === 'PAGE' ? 'Pages' : 'Posts' }}</a>
      @if (loadedId) {
        <span class="wp-pill" [class]="'wp-pill-' + status.toLowerCase()">{{ statusLabel() }}</span>
        @if (status === 'PUBLISHED') {
          <a [href]="viewUrl()" target="_blank" rel="noopener" class="text-wp">View</a>
        }
      }
      <span class="ml-auto text-wp-sm text-wp-muted">{{ savedAt() }}</span>
    </div>

    @if (error()) {
      <div class="wp-notice wp-notice-error" role="alert">{{ error() }}</div>
    }

    @if (!ready()) {
      <div class="wp-box p-10 text-center text-wp-muted">Loading editor…</div>
    } @else {
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
        <!-- main column -->
        <div class="min-w-0">
          <input
            class="wp-title-input"
            placeholder="Add title"
            [(ngModel)]="title"
            (ngModelChange)="slugEditing = false"
            aria-label="Title"
          />

          @if (!slugEditing) {
            <div class="mb-3 flex flex-wrap items-baseline gap-2 text-wp text-wp-muted">
              <span class="text-wp-sm">Permalink:</span>
              <span class="text-wp-blue break-all">/{{ slugPreview() }}/</span>
              <button type="button" class="wp-btn wp-btn-plain" (click)="startSlugEdit()">Edit</button>
            </div>
          } @else {
            <div class="mb-3 flex flex-wrap items-center gap-2 text-wp text-wp-muted">
              <span class="text-wp-sm">/</span>
              <input
                class="wp-input max-w-md"
                [(ngModel)]="slug"
                (ngModelChange)="slugTouched = true"
                (blur)="slugEditing = false"
                aria-label="Slug"
              />
              <span class="text-wp-sm">/</span>
              <button type="button" class="wp-btn" (click)="slugEditing = false">OK</button>
            </div>
          }

          <label class="wp-label" for="excerpt">Excerpt <span class="font-normal text-wp-muted">(optional summary)</span></label>
          <textarea
            id="excerpt"
            class="wp-input mb-4 min-h-16"
            rows="2"
            [(ngModel)]="excerpt"
            placeholder="Write an excerpt…"
          ></textarea>

          <wp-tiptap
            [content]="content()"
            (contentChange)="content.set($event)"
            [placeholder]="type === 'PAGE' ? 'Write your page…' : 'Tell your story…'"
          />

          <!-- SEO -->
          <details class="wp-box mt-4 p-4" [open]="seoOpen">
            <summary class="cursor-pointer font-semibold text-wp-lg select-none">SEO</summary>
            <div class="mt-3 grid gap-3">
              <div>
                <label class="wp-label" for="seoTitle">SEO title</label>
                <input id="seoTitle" class="wp-input" maxlength="70" [(ngModel)]="seoTitle" placeholder="{{ title || 'Custom title' }}" />
                <p class="text-wp-sm text-wp-muted mt-1">{{ seoTitle.length }}/70 characters</p>
              </div>
              <div>
                <label class="wp-label" for="seoDesc">Meta description</label>
                <textarea id="seoDesc" class="wp-input" rows="2" maxlength="160" [(ngModel)]="seoDescription" placeholder="Description used in search results"></textarea>
                <p class="text-wp-sm text-wp-muted mt-1">{{ seoDescription.length }}/160 characters</p>
              </div>
              <div>
                <label class="wp-label" for="canonical">Canonical URL</label>
                <input id="canonical" class="wp-input" [(ngModel)]="canonicalUrl" placeholder="https://… (leave empty for the default)" />
              </div>
              <label class="flex items-center gap-2 text-wp">
                <input type="checkbox" class="accent-wp-blue" [(ngModel)]="noIndex" />
                Ask search engines not to index this {{ type === 'PAGE' ? 'page' : 'post' }}
              </label>
            </div>
          </details>
        </div>

        <!-- sidebar -->
        <aside class="grid content-start gap-4">
          <!-- publish -->
          <div class="wp-box p-4">
            <h3 class="mb-3">{{ loadedId ? 'Update' : 'Publish' }}</h3>
            <label class="wp-label" for="status">Status</label>
            <select id="status" class="wp-input" [(ngModel)]="status">
              <option value="DRAFT">Draft</option>
              <option value="PENDING">Pending Review</option>
              <option value="PUBLISHED">Published</option>
              <option value="SCHEDULED">Scheduled</option>
            </select>

            @if (status === 'PUBLISHED' || status === 'SCHEDULED') {
              <label class="wp-label mt-3" for="pubdate">Publish date</label>
              <input id="pubdate" type="datetime-local" class="wp-input" [(ngModel)]="publishedAtLocal" />
              <p class="mt-1 text-wp-sm text-wp-muted">A future date schedules the post automatically.</p>
            }

            <label class="wp-label mt-3" for="commentStatus">Comments</label>
            <select id="commentStatus" class="wp-input" [(ngModel)]="commentStatus">
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>

            @if (type === 'POST') {
              <label class="mt-3 flex items-center gap-2 text-wp">
                <input type="checkbox" class="accent-wp-blue" [(ngModel)]="isSticky" />
                Make this post sticky
              </label>
            }

            <div class="mt-4 grid gap-2">
              <button type="button" class="wp-btn wp-btn-primary w-full" [disabled]="saving()" (click)="save()">
                {{ saveLabel() }}
              </button>
              @if (loadedId) {
                <button type="button" class="wp-btn w-full !border-wp-red !text-wp-red" (click)="trash()">
                  Move to Trash
                </button>
              }
            </div>
          </div>

          <!-- featured image -->
          <div class="wp-box p-4">
            <h3 class="mb-3">Featured Image</h3>
            @if (featured; as img) {
              <img [src]="api.thumb(img, 400)" [alt]="img.altText ?? img.filename" class="mb-2 w-full rounded border border-wp-border" />
              <div class="flex gap-2">
                <button type="button" class="wp-btn" (click)="pickFeatured()">Replace</button>
                <button type="button" class="wp-btn" (click)="featured = null">Remove</button>
              </div>
            } @else {
              <button type="button" class="wp-btn w-full" (click)="pickFeatured()">Set featured image</button>
            }
          </div>

          @if (type === 'PAGE') {
            <!-- page attributes -->
            <div class="wp-box p-4">
              <h3 class="mb-3">Page Attributes</h3>
              <label class="wp-label" for="parent">Parent</label>
              <select id="parent" class="wp-input" [(ngModel)]="parentId">
                <option value="">(no parent)</option>
                @for (p of parentPages(); track p.id) {
                  <option [value]="p.id">{{ p.title }}</option>
                }
              </select>
            </div>
          } @else {
            <!-- categories -->
            <div class="wp-box p-4">
              <h3 class="mb-3">Categories</h3>
              <div class="grid max-h-48 gap-1.5 overflow-y-auto">
                @for (c of categories(); track c.id) {
                  <label class="flex items-center gap-2 text-wp">
                    <input
                      type="checkbox"
                      class="accent-wp-blue"
                      [checked]="selectedTerms.includes(c.id)"
                      (change)="toggleTerm(c.id, $event)"
                    />
                    {{ c.name }}
                  </label>
                } @empty {
                  <p class="text-wp-sm text-wp-muted">No categories yet.</p>
                }
              </div>
            </div>

            <!-- tags -->
            <div class="wp-box p-4">
              <h3 class="mb-3">Tags</h3>
              <div class="mb-2 flex flex-wrap gap-1.5">
                @for (t of tags(); track t.id) {
                  <label
                    class="cursor-pointer rounded-full border px-2 py-0.5 text-wp-sm"
                    [class.border-wp-blue]="selectedTerms.includes(t.id)"
                    [class.bg-wp-blue]="selectedTerms.includes(t.id)"
                    [class.text-white]="selectedTerms.includes(t.id)"
                    [class.border-wp-border]="!selectedTerms.includes(t.id)"
                  >
                    <input
                      type="checkbox"
                      class="hidden"
                      [checked]="selectedTerms.includes(t.id)"
                      (change)="toggleTerm(t.id, $event)"
                    />
                    {{ t.name }}
                  </label>
                } @empty {
                  <p class="text-wp-sm text-wp-muted">No tags yet.</p>
                }
              </div>
              <div class="flex gap-2">
                <input
                  class="wp-input"
                  placeholder="Add new tag"
                  [(ngModel)]="newTag"
                  (keyup.enter)="addTag()"
                  aria-label="Add new tag"
                />
                <button type="button" class="wp-btn" (click)="addTag()">Add</button>
              </div>
            </div>
          }
        </aside>
      </div>
    }
  `,
})
export class PostEditorPage implements OnDestroy {
  readonly api = inject(Api);
  readonly env = environment;

  type: 'POST' | 'PAGE' = 'POST';
  loadedId: string | null = null;
  seoOpen = false;

  // form model
  title = '';
  slug = '';
  slugTouched = false;
  slugEditing = false;
  excerpt = '';
  status: PostStatusName = 'DRAFT';
  publishedAtLocal = '';
  commentStatus: 'OPEN' | 'CLOSED' = 'OPEN';
  isSticky = false;
  parentId = '';
  seoTitle = '';
  seoDescription = '';
  canonicalUrl = '';
  noIndex = false;
  featured: MediaSummary | null = null;
  selectedTerms: string[] = [];
  newTag = '';

  readonly content = signal<Record<string, unknown>>(EMPTY_DOC);
  readonly ready = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly savedAt = signal('');
  readonly categories = signal<TermSummary[]>([]);
  readonly tags = signal<TermSummary[]>([]);
  readonly parentPages = signal<AdminPostSummary[]>([]);

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notify = inject(Notify);
  private confirm = inject(Confirm);
  private dialog = inject(MatDialog);
  private sub = new Subscription();

  constructor() {
    this.type = this.route.snapshot.data['type'] === 'PAGE' ? 'PAGE' : 'POST';
    this.sub.add(
      this.route.paramMap.subscribe((params) => this.load(params.get('id'))),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  slugPreview(): string {
    return this.slugTouched && this.slug.trim() ? slugify(this.slug) : slugify(this.title);
  }

  startSlugEdit(): void {
    this.slug = this.slugPreview();
    this.slugTouched = true;
    this.slugEditing = true;
  }

  statusLabel(): string {
    const labels: Record<string, string> = {
      DRAFT: 'Draft', PENDING: 'Pending', PUBLISHED: 'Published',
      SCHEDULED: 'Scheduled', TRASH: 'Trash',
    };
    return labels[this.status] ?? this.status;
  }

  saveLabel(): string {
    if (this.saving()) return 'Saving…';
    if (this.status === 'PENDING') return 'Submit for Review';
    if (this.status === 'SCHEDULED') return 'Schedule';
    if (this.status === 'DRAFT') return 'Save Draft';
    return this.loadedId ? 'Update' : 'Publish';
  }

  viewUrl(): string {
    return `${this.env.siteUrl}/${this.slugPreview()}/`;
  }

  toggleTerm(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedTerms = checked
      ? [...this.selectedTerms, id]
      : this.selectedTerms.filter((t) => t !== id);
  }

  addTag(): void {
    const name = this.newTag.trim();
    if (!name) return;
    this.api.post<TermSummary>('/terms', { taxonomy: 'TAG', name }).subscribe({
      next: (t) => {
        this.tags.update((list) => [...list, t]);
        this.selectedTerms = [...this.selectedTerms, t.id];
        this.newTag = '';
        this.notify.ok(`Tag “${t.name}” added`);
      },
      error: (err: unknown) => this.notify.error(err),
    });
  }

  pickFeatured(): void {
    const ref = this.dialog.open(MediaPickerDialog, {
      data: { title: 'Featured image' },
      width: '860px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe((m: MediaSummary | null) => {
      if (m) this.featured = m;
    });
  }

  save(): void {
    if (this.saving()) return;
    if (!this.title.trim()) {
      this.error.set('Please enter a title before saving.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);

    const creating = !this.loadedId;
    const body = this.body();
    const req$ = creating
      ? this.api.post<AdminPostDetail>('/posts', { type: this.type, ...body })
      : this.api.patch<AdminPostDetail>(`/posts/${this.loadedId}`, body);

    req$.subscribe({
      next: (post) => {
        this.saving.set(false);
        if (creating) {
          // Different route config → the editor remounts and loads the post.
          void this.router.navigate(['/', this.type === 'PAGE' ? 'pages' : 'posts', post.id], {
            replaceUrl: true,
          });
        } else {
          this.apply(post);
          this.savedAt.set(`Saved ${new Date().toLocaleTimeString()}`);
        }
        this.notify.ok(
          creating
            ? this.status === 'PUBLISHED'
              ? 'Published!'
              : 'Post saved.'
            : 'Post updated.',
        );
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.notify.error(err, 'Save failed');
        this.error.set('Save failed — see the notice above for details.');
      },
    });
  }

  async trash(): Promise<void> {
    if (!this.loadedId) return;
    const ok = await this.confirm.ask({
      title: 'Move to Trash?',
      message: `“${this.title}” will be moved to the trash.`,
    });
    if (!ok) return;
    this.api.patch(`/posts/${this.loadedId}`, { status: 'TRASH' }).subscribe({
      next: () => {
        this.notify.ok('Post moved to trash.');
        void this.router.navigate([this.type === 'PAGE' ? '/pages' : '/posts']);
      },
      error: (err: unknown) => this.notify.error(err),
    });
  }

  private body(): Record<string, unknown> {
    const publishedAt =
      fromLocalInput(this.publishedAtLocal) ??
      (this.status === 'PUBLISHED' || this.status === 'SCHEDULED'
        ? new Date().toISOString()
        : undefined);
    return {
      title: this.title.trim(),
      slug: this.slugTouched && this.slug.trim() ? this.slug.trim() : undefined,
      excerpt: this.excerpt.trim(),
      content: this.content(),
      status: this.status,
      publishedAt,
      featuredImageId: this.featured
        ? this.featured.id
        : this.loadedId
          ? null
          : undefined,
      commentStatus: this.commentStatus,
      isSticky: this.type === 'POST' ? this.isSticky : undefined,
      termIds: this.type === 'POST' ? this.selectedTerms : undefined,
      parentId: this.type === 'PAGE' ? this.parentId || null : undefined,
      seoTitle: this.seoTitle.trim(),
      seoDescription: this.seoDescription.trim(),
      canonicalUrl: this.canonicalUrl.trim(),
      noIndex: this.noIndex,
    };
  }

  private load(id: string | null): void {
    this.ready.set(false);
    this.error.set(null);

    const terms$ = forkJoin({
      categories: this.api.get<TermSummary[]>('/terms', { taxonomy: 'CATEGORY' }),
      tags: this.api.get<TermSummary[]>('/terms', { taxonomy: 'TAG' }),
      pages:
        this.type === 'PAGE'
          ? this.api.get<Paged<AdminPostSummary>>('/posts', { type: 'PAGE', perPage: 100 })
          : of(null),
    });

    terms$.subscribe({
      next: (r) => {
        this.categories.set(r.categories);
        this.tags.set(r.tags);
        this.parentPages.set(r.pages?.items ?? []);
        if (id) {
          this.loadPost(id);
        } else {
          this.reset();
          this.ready.set(true);
        }
      },
      error: (err: unknown) => {
        this.notify.error(err);
        this.ready.set(true);
      },
    });
  }

  private loadPost(id: string): void {
    this.api.get<AdminPostDetail>(`/posts/${id}`).subscribe({
      next: (post) => {
        this.apply(post);
        this.ready.set(true);
      },
      error: (err: unknown) => {
        this.error.set('This post could not be loaded (it may have been deleted).');
        this.notify.error(err);
        this.ready.set(true);
      },
    });
  }

  private apply(post: AdminPostDetail): void {
    this.loadedId = post.id;
    this.title = post.title;
    this.slug = post.slug;
    this.slugTouched = false;
    this.slugEditing = false;
    this.excerpt = post.excerpt ?? '';
    this.status = post.status;
    this.publishedAtLocal = toLocalInput(post.publishedAt);
    this.commentStatus = post.commentStatus;
    this.isSticky = post.isSticky;
    this.parentId = post.parentId ?? '';
    this.seoTitle = post.seoTitle ?? '';
    this.seoDescription = post.seoDescription ?? '';
    this.canonicalUrl = post.canonicalUrl ?? '';
    this.noIndex = post.noIndex;
    this.featured = post.featuredImage ?? null;
    this.selectedTerms = post.terms.map((t) => t.term.id);
    this.content.set(
      (post.content as Record<string, unknown> | null) ?? EMPTY_DOC,
    );
    this.seoOpen = !!post.seoTitle || !!post.seoDescription || post.noIndex;
    this.savedAt.set(`Last edited ${new Date(post.updatedAt).toLocaleString()}`);
  }

  private reset(): void {
    this.loadedId = null;
    this.title = '';
    this.slug = '';
    this.slugTouched = false;
    this.slugEditing = false;
    this.excerpt = '';
    this.status = 'DRAFT';
    this.publishedAtLocal = '';
    this.commentStatus = 'OPEN';
    this.isSticky = false;
    this.parentId = '';
    this.seoTitle = '';
    this.seoDescription = '';
    this.canonicalUrl = '';
    this.noIndex = false;
    this.featured = null;
    this.selectedTerms = [];
    this.newTag = '';
    this.content.set(EMPTY_DOC);
    this.savedAt.set('');
    this.seoOpen = false;
  }
}
