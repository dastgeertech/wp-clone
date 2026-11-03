import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MediaSummary, Paged } from '@wp-clone/shared-types';
import { Api } from '../core/api';
import { Notify } from '../core/notify';
import { Confirm } from '../shared/confirm';
import { formatBytes } from '../shared/format';
import { PagerComponent } from '../shared/pager';

@Component({
  selector: 'wp-media-page',
  imports: [FormsModule, PagerComponent],
  template: `
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <h1 class="mb-0">Media Library</h1>
      <input
        #file
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        (change)="upload(file)"
      />
      <button type="button" class="wp-btn" [disabled]="busy()" (click)="file.click()">
        {{ busy() ? 'Uploading…' : '+ Add New File' }}
      </button>
      <form class="ml-auto flex gap-2" (ngSubmit)="search(qInput.value)">
        <input #qInput class="wp-input w-44" placeholder="Search…" [value]="q()" aria-label="Search media" />
        <button class="wp-btn" type="submit">Search</button>
      </form>
    </div>

    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        @if (loading() && items().length === 0) {
          <p class="py-10 text-center text-wp-muted">Loading…</p>
        } @else if (items().length === 0) {
          <div class="wp-box p-10 text-center text-wp-muted">
            No media found. Upload an image to get started.
          </div>
        } @else {
          <div class="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
            @for (m of items(); track m.id) {
              <button
                type="button"
                class="overflow-hidden rounded border-2 bg-white text-left"
                [class.border-wp-blue]="selected()?.id === m.id"
                [class.border-wp-border]="selected()?.id !== m.id"
                (click)="select(m)"
                [title]="m.filename"
              >
                <img
                  [src]="api.thumb(m, 320)"
                  [alt]="m.altText ?? m.filename"
                  loading="lazy"
                  class="aspect-square w-full bg-wp-gray object-cover"
                />
                <span class="block truncate px-1.5 py-1 text-wp-sm">{{ m.filename }}</span>
              </button>
            }
          </div>
          <wp-pager [page]="page()" [total]="total()" [perPage]="20" (pageChange)="load($event)" />
        }
      </div>

      <!-- attachment details -->
      <aside class="wp-box h-fit p-4">
        @if (selected(); as m) {
          <h3 class="mb-2 truncate" [title]="m.filename">{{ m.filename }}</h3>
          <img
            [src]="api.abs(m.url)"
            [alt]="m.altText ?? m.filename"
            class="mb-3 w-full rounded border border-wp-border bg-wp-gray"
          />
          <dl class="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-wp text-wp-muted">
            <dt>Size:</dt><dd class="text-wp-ink">{{ bytes(m.size) }}</dd>
            <dt>Dimensions:</dt><dd class="text-wp-ink">{{ m.width ?? '?' }} × {{ m.height ?? '?' }}</dd>
            <dt>Type:</dt><dd class="text-wp-ink">{{ m.mimeType }}</dd>
          </dl>

          <label class="wp-label" for="alt">Alt text</label>
          <input id="alt" class="wp-input mb-2" [(ngModel)]="altText" placeholder="Describe the image" />

          <label class="wp-label" for="caption">Caption</label>
          <textarea id="caption" class="wp-input mb-3" rows="2" [(ngModel)]="caption"></textarea>

          <div class="grid gap-2">
            <button type="button" class="wp-btn wp-btn-primary" [disabled]="busy()" (click)="saveDetails()">
              Save Details
            </button>
            <button type="button" class="wp-btn" (click)="copyUrl(m)">Copy URL</button>
            <button type="button" class="wp-btn !border-wp-red !text-wp-red" (click)="remove(m)">
              Delete Permanently
            </button>
          </div>
        } @else {
          <p class="text-wp text-wp-muted">Select an image to edit its details.</p>
        }
      </aside>
    </div>
  `,
})
export class MediaPage implements OnDestroy {
  readonly api = inject(Api);
  private notify = inject(Notify);
  private confirm = inject(Confirm);

  readonly items = signal<MediaSummary[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly selected = signal<MediaSummary | null>(null);
  readonly q = signal('');

  altText = '';
  caption = '';

  readonly bytes = formatBytes;

  private sub?: { unsubscribe: () => void };
  constructor() {
    this.load(1);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  load(page: number): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.sub = this.api
      .get<Paged<MediaSummary>>('/media', {
        page,
        perPage: 20,
        search: this.q() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.page.set(res.page);
          this.loading.set(false);
          const sel = this.selected();
          if (sel) {
            const fresh = res.items.find((i) => i.id === sel.id) ?? null;
            this.selected.set(fresh);
            if (fresh) {
              this.altText = fresh.altText ?? '';
              this.caption = fresh.caption ?? '';
            }
          }
        },
        error: (err: unknown) => {
          this.notify.error(err);
          this.loading.set(false);
        },
      });
  }

  search(term: string): void {
    this.q.set(term.trim());
    this.load(1);
  }

  select(m: MediaSummary): void {
    this.selected.set(m);
    this.altText = m.altText ?? '';
    this.caption = m.caption ?? '';
  }

  upload(input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    if (!files.length || this.busy()) return;
    this.busy.set(true);

    const fail = (err: unknown) => {
      this.busy.set(false);
      this.notify.error(err, 'Upload failed');
      this.load(1);
    };
    const sendAt = (i: number): void => {
      if (i >= files.length) {
        this.busy.set(false);
        input.value = '';
        this.notify.ok(`${files.length} file${files.length === 1 ? '' : 's'} uploaded`);
        this.load(1);
        return;
      }
      this.api.upload<MediaSummary>('/media', files[i]).subscribe({
        next: () => sendAt(i + 1),
        error: fail,
      });
    };
    sendAt(0);
  }

  saveDetails(): void {
    const m = this.selected();
    if (!m || this.busy()) return;
    this.busy.set(true);
    this.api
      .patch<MediaSummary>(`/media/${m.id}`, { altText: this.altText, caption: this.caption })
      .subscribe({
        next: (updated) => {
          this.busy.set(false);
          this.select(updated);
          this.items.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
          this.notify.ok('Details saved');
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.notify.error(err);
        },
      });
  }

  async remove(m: MediaSummary): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete permanently?',
      message: `“${m.filename}” and its generated sizes will be deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.api.delete(`/media/${m.id}`).subscribe({
      next: () => {
        this.notify.ok('Image deleted');
        this.selected.set(null);
        this.load(this.page());
      },
      error: (err: unknown) => this.notify.error(err),
    });
  }

  async copyUrl(m: MediaSummary): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.api.abs(m.url));
      this.notify.ok('URL copied to clipboard');
    } catch {
      this.notify.error(new Error('Clipboard unavailable — copy manually: ' + this.api.abs(m.url)));
    }
  }
}
