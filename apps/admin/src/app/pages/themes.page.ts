import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeState } from '@wp-clone/shared-types';
import { Api } from '../core/api';
import { Notify } from '../core/notify';
import { environment } from '../../environments/environment';

/** Manage Themes — activate / switch between installed themes. */
@Component({
  selector: 'wp-themes-page',
  imports: [RouterLink],
  template: `
    <div class="mb-4 flex items-center gap-3">
      <h1 class="mb-0">Themes</h1>
      <a routerLink="/appearance/customizer" class="wp-btn">Customize the active theme</a>
      <a [href]="env.siteUrl" target="_blank" rel="noopener" class="wp-btn ml-auto">Visit Site</a>
    </div>

    @if (loading()) {
      <p class="py-10 text-center text-wp-muted">Loading themes…</p>
    } @else {
      <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        @for (t of themes(); track t.id) {
          <article class="wp-box overflow-hidden">
            <div class="relative">
              <img
                [src]="screenshot(t)"
                [alt]="t.name + ' screenshot'"
                class="aspect-[4/3] w-full border-b border-wp-border bg-wp-gray object-cover"
                loading="lazy"
              />
              @if (t.isActive) {
                <span
                  class="absolute top-2 left-2 rounded-sm bg-wp-blue px-2 py-0.5 text-wp-sm font-semibold text-white shadow"
                >
                  Active
                </span>
              }
            </div>
            <div class="p-4">
              <h2 class="text-wp-lg font-semibold">{{ t.name }} <span class="text-wp-sm font-normal text-wp-muted">v{{ t.version }}</span></h2>
              @if (t.author) {
                <p class="text-wp text-wp-muted">By {{ t.author }}</p>
              }
              @if (t.description) {
                <p class="mt-2 text-wp text-wp-ink">{{ t.description }}</p>
              }
              <div class="mt-3 flex flex-wrap gap-2">
                @if (t.isActive) {
                  <a routerLink="/appearance/customizer" class="wp-btn wp-btn-primary">Customize</a>
                } @else {
                  <button type="button" class="wp-btn wp-btn-primary" [disabled]="busy()" (click)="activate(t)">
                    Activate
                  </button>
                }
              </div>
            </div>
          </article>
        }
      </div>
    }
  `,
})
export class ThemesPage {
  private api = inject(Api);
  private notify = inject(Notify);
  readonly env = environment;

  readonly themes = signal<ThemeState[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);

  constructor() {
    this.api.get<ThemeState[]>('/themes').subscribe({
      next: (list) => {
        this.themes.set(list);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.notify.error(err);
        this.loading.set(false);
      },
    });
  }

  screenshot(t: ThemeState): string {
    return t.screenshot ? this.env.siteUrl + t.screenshot : '';
  }

  activate(t: ThemeState): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.post<ThemeState[]>(`/themes/${t.id}/activate`).subscribe({
      next: (list) => {
        this.busy.set(false);
        this.themes.set(list);
        this.notify.ok(`“${t.name}” is now active`);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.notify.error(err);
      },
    });
  }
}
