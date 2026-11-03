import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TaxonomyName, TermSummary } from '@wp-clone/shared-types';
import { Api } from '../core/api';
import { Notify } from '../core/notify';
import { Confirm } from '../shared/confirm';

@Component({
  selector: 'wp-terms-page',
  imports: [FormsModule, RouterLink],
  template: `
    <h1>{{ taxonomy === 'TAG' ? 'Tags' : 'Categories' }}</h1>

    <!-- taxonomy tabs -->
    <ul class="mb-4 flex gap-1 border-b border-wp-border text-wp">
      <li>
        <a
          routerLink="/terms"
          [queryParams]="{ taxonomy: 'CATEGORY' }"
          class="block px-3 py-1.5"
          [class.bg-white]="taxonomy === 'CATEGORY'"
          [class.font-semibold]="taxonomy === 'CATEGORY'"
          [class.text-wp-blue]="taxonomy === 'CATEGORY'"
        >
          Categories
        </a>
      </li>
      <li>
        <a
          routerLink="/terms"
          [queryParams]="{ taxonomy: 'TAG' }"
          class="block px-3 py-1.5"
          [class.bg-white]="taxonomy === 'TAG'"
          [class.font-semibold]="taxonomy === 'TAG'"
          [class.text-wp-blue]="taxonomy === 'TAG'"
        >
          Tags
        </a>
      </li>
    </ul>

    <div class="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <!-- add form -->
      <div class="wp-box h-fit p-4">
        <h3 class="mb-3">{{ taxonomy === 'TAG' ? 'Add New Tag' : 'Add New Category' }}</h3>
        <label class="wp-label" for="name">Name</label>
        <input id="name" class="wp-input mb-2" [(ngModel)]="draft.name" placeholder="{{ taxonomy === 'TAG' ? 'e.g. angular' : 'e.g. News' }}" />
        @if (taxonomy === 'CATEGORY') {
          <label class="wp-label" for="slug">Slug</label>
          <input id="slug" class="wp-input mb-2" [(ngModel)]="draft.slug" placeholder="(auto-generated)" />
          <label class="wp-label" for="desc">Description</label>
          <textarea id="desc" class="wp-input mb-2" rows="3" [(ngModel)]="draft.description"></textarea>
        }
        <button type="button" class="wp-btn wp-btn-primary" [disabled]="busy()" (click)="create()">
          {{ taxonomy === 'TAG' ? 'Add New Tag' : 'Add New Category' }}
        </button>
      </div>

      <!-- list -->
      <div>
        @if (loading()) {
          <p class="py-8 text-center text-wp-muted">Loading…</p>
        } @else if (terms().length === 0) {
          <div class="wp-box p-8 text-center text-wp-muted">No {{ taxonomy === 'TAG' ? 'tags' : 'categories' }} yet.</div>
        } @else {
          <div class="wp-box overflow-x-auto">
            <table class="wp-table">
              <thead>
                <tr>
                  <th>Name</th>
                  @if (taxonomy === 'CATEGORY') {
                    <th class="hidden md:table-cell">Description</th>
                  }
                  <th>Slug</th>
                  <th>Count</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (t of terms(); track t.id) {
                  @if (editingId === t.id) {
                    <tr>
                      <td>
                        <input class="wp-input mb-1" [(ngModel)]="editDraft.name" aria-label="Name" />
                        <input class="wp-input" [(ngModel)]="editDraft.slug" placeholder="slug" aria-label="Slug" />
                      </td>
                      @if (taxonomy === 'CATEGORY') {
                        <td class="hidden md:table-cell">
                          <textarea class="wp-input" rows="2" [(ngModel)]="editDraft.description" aria-label="Description"></textarea>
                        </td>
                      }
                      <td colspan="2" class="text-wp-muted">—</td>
                      <td class="whitespace-nowrap">
                        <button type="button" class="wp-btn wp-btn-primary" (click)="update(t)">Update</button>
                        <button type="button" class="wp-btn wp-btn-plain" (click)="cancelEdit()">Cancel</button>
                      </td>
                    </tr>
                  } @else {
                    <tr>
                      <td>
                        <span class="font-semibold text-wp-ink">{{ t.name }}</span>
                        <div class="mt-1 flex gap-2 text-wp-sm">
                          <button type="button" class="wp-btn-plain wp-btn" (click)="startEdit(t)">Edit</button>
                          <button type="button" class="wp-btn-plain wp-btn !text-wp-red" (click)="remove(t)">Delete</button>
                        </div>
                      </td>
                      @if (taxonomy === 'CATEGORY') {
                        <td class="hidden md:table-cell text-wp text-wp-muted">{{ t.description || '—' }}</td>
                      }
                      <td class="text-wp text-wp-muted">{{ t.slug }}</td>
                      <td class="text-wp">
                        <a [routerLink]="taxonomy === 'TAG' ? ['/tag', t.slug] : ['/category', t.slug]" target="_blank" rel="noopener">
                          {{ t.postCount }}
                        </a>
                      </td>
                      <td></td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
          <p class="mt-3 text-wp-sm text-wp-muted">
            Tip: the count links open the public archive.
            <a routerLink="/" target="_blank" rel="noopener">Visit the site</a>
          </p>
        }
      </div>
    </div>
  `,
})
export class TermsPage implements OnDestroy {
  private api = inject(Api);
  private notify = inject(Notify);
  private confirm = inject(Confirm);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  taxonomy: TaxonomyName = 'CATEGORY';
  readonly terms = signal<TermSummary[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);

  editingId: string | null = null;
  editDraft = { name: '', slug: '', description: '' };
  draft = { name: '', slug: '', description: '' };

  private sub = { unsubscribe: () => undefined as void };

  constructor() {
    this.sub = this.route.queryParamMap.subscribe((params) => {
      this.taxonomy = params.get('taxonomy') === 'TAG' ? 'TAG' : 'CATEGORY';
      this.editingId = null;
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private load(): void {
    this.loading.set(true);
    this.api.get<TermSummary[]>('/terms', { taxonomy: this.taxonomy }).subscribe({
      next: (list) => {
        this.terms.set(list);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.notify.error(err);
        this.loading.set(false);
      },
    });
  }

  create(): void {
    const name = this.draft.name.trim();
    if (!name || this.busy()) return;
    this.busy.set(true);
    this.api
      .post<TermSummary>('/terms', {
        taxonomy: this.taxonomy,
        name,
        slug: this.draft.slug.trim() || undefined,
        description: this.draft.description.trim() || undefined,
      })
      .subscribe({
        next: (t) => {
          this.busy.set(false);
          this.draft = { name: '', slug: '', description: '' };
          this.terms.update((list) => [...list, t].sort((a, b) => a.name.localeCompare(b.name)));
          this.notify.ok(`${t.name} added`);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.notify.error(err);
        },
      });
  }

  startEdit(t: TermSummary): void {
    this.editingId = t.id;
    this.editDraft = {
      name: t.name,
      slug: t.slug,
      description: t.description ?? '',
    };
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  update(t: TermSummary): void {
    const name = this.editDraft.name.trim();
    if (!name) return;
    this.api
      .patch<TermSummary>(`/terms/${t.id}`, {
        name,
        slug: this.editDraft.slug.trim(),
        description: this.editDraft.description.trim(),
      })
      .subscribe({
        next: (updated) => {
          this.editingId = null;
          this.terms.update((list) =>
            list.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)),
          );
          this.notify.ok('Term updated');
        },
        error: (err: unknown) => this.notify.error(err),
      });
  }

  async remove(t: TermSummary): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Delete ${this.taxonomy === 'TAG' ? 'tag' : 'category'}?`,
      message: `“${t.name}” will be removed. Posts keep their content but lose this assignment.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.api.delete(`/terms/${t.id}`).subscribe({
      next: () => {
        this.terms.update((list) => list.filter((x) => x.id !== t.id));
        this.notify.ok('Deleted');
      },
      error: (err: unknown) => this.notify.error(err),
    });
  }
}
