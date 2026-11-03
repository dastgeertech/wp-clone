import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MediaSummary, Paged } from '@wp-clone/shared-types';
import { Api } from '../core/api';
import { Notify } from '../core/notify';

/**
 * Reusable "choose an image" dialog (featured image, customizer logo,
 * insert-into-post). Uploads go straight through the API.
 */
@Component({
  selector: 'wp-media-picker-dialog',
  imports: [FormsModule, MatDialogTitle, MatDialogContent, MatDialogActions],
  template: `
    <h2 mat-dialog-title>{{ data?.title ?? 'Select an image' }}</h2>
    <div mat-dialog-content class="min-w-[min(78vw,720px)]">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input
          #file
          type="file"
          accept="image/*"
          class="hidden"
          (change)="upload(file)"
        />
        <button type="button" class="wp-btn" [disabled]="busy" (click)="file.click()">
          {{ busy ? 'Uploading…' : 'Upload File' }}
        </button>
        <input
          class="wp-input ml-auto w-48"
          placeholder="Search media…"
          [(ngModel)]="search"
          (ngModelChange)="load(1)"
          aria-label="Search media"
        />
      </div>

      @if (loading && items.length === 0) {
        <p class="py-8 text-center text-wp-muted">Loading…</p>
      } @else if (items.length === 0) {
        <p class="py-8 text-center text-wp-muted">No images yet — upload one to get started.</p>
      } @else {
        <div class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          @for (m of items; track m.id) {
            <button
              type="button"
              class="overflow-hidden rounded border border-wp-border bg-white text-left hover:border-wp-blue focus:outline focus:outline-2 focus:outline-wp-blue"
              (click)="ref.close(m)"
              [title]="m.filename"
            >
              <img
                [src]="api.thumb(m, 320)"
                [alt]="m.altText ?? m.filename"
                loading="lazy"
                class="aspect-square w-full bg-wp-gray object-cover"
              />
              <span class="block truncate px-1.5 py-1 text-wp-sm text-wp-ink">{{ m.filename }}</span>
            </button>
          }
        </div>

        <div class="mt-3 flex items-center justify-between text-wp text-wp-muted">
          <button type="button" class="wp-btn" [disabled]="page <= 1" (click)="load(page - 1)">« Previous</button>
          <span>Page {{ page }} of {{ totalPages }}</span>
          <button type="button" class="wp-btn" [disabled]="page >= totalPages" (click)="load(page + 1)">Next »</button>
        </div>
      }
    </div>
    <div mat-dialog-actions align="end">
      <button type="button" class="wp-btn" (click)="ref.close(null)">Cancel</button>
    </div>
  `,
})
export class MediaPickerDialog implements OnInit {
  readonly ref = inject<MatDialogRef<MediaPickerDialog, MediaSummary | null>>(
    MatDialogRef,
  );
  readonly data = inject<{ title?: string } | null>(MAT_DIALOG_DATA, { optional: true });
  readonly api = inject(Api);
  private notify = inject(Notify);

  items: MediaSummary[] = [];
  page = 1;
  total = 0;
  search = '';
  loading = true;
  busy = false;

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / 20));
  }

  ngOnInit(): void {
    this.load(1);
  }

  load(page: number): void {
    this.loading = true;
    this.api
      .get<Paged<MediaSummary>>('/media', { page, perPage: 20, search: this.search || undefined })
      .subscribe({
        next: (res) => {
          this.items = res.items;
          this.total = res.total;
          this.page = res.page;
          this.loading = false;
        },
        error: (err: unknown) => {
          this.notify.error(err);
          this.loading = false;
        },
      });
  }

  upload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file || this.busy) return;
    this.busy = true;
    this.api.upload<MediaSummary>('/media', file).subscribe({
      next: (m) => {
        this.busy = false;
        input.value = '';
        this.notify.ok(`Uploaded ${m.filename}`);
        this.load(1);
      },
      error: (err: unknown) => {
        this.busy = false;
        this.notify.error(err, 'Upload failed');
      },
    });
  }
}
