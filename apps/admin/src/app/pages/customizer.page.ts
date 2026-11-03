import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ThemeSettingControl, ThemeState } from '@wp-clone/shared-types';
import { Api } from '../core/api';
import { Notify } from '../core/notify';
import { MediaPickerDialog } from '../shared/media-picker';
import { environment } from '../../environments/environment';

interface Section {
  id: string;
  title: string;
  controls: ThemeSettingControl[];
}

const SECTION_TITLES: Record<string, string> = {
  header: 'Site Identity',
  colors: 'Colors',
  typography: 'Typography',
  layout: 'Layout',
  footer: 'Footer',
  posts: 'Posts',
  hero: 'Hero',
};

/** Appearance → Customize: a form generated from the theme's settingsSchema. */
@Component({
  selector: 'wp-customizer-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <h1 class="mb-0">Customize</h1>
      @if (theme(); as t) {
        <span class="text-wp text-wp-muted">Editing “<strong>{{ t.name }}</strong>”</span>
      }
      <a routerLink="/appearance/themes" class="wp-btn">Manage Themes</a>
      <a [href]="env.siteUrl" target="_blank" rel="noopener" class="wp-btn ml-auto">Preview Site</a>
    </div>

    @if (!theme()) {
      <p class="py-10 text-center text-wp-muted">Loading…</p>
    } @else {
      @if (error()) {
        <div class="wp-notice wp-notice-error">{{ error() }}</div>
      }

      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div class="grid content-start gap-4">
          @for (s of sections; track s.id) {
            <section class="wp-box p-4">
              <h2 class="mb-3 text-wp-lg font-normal border-b border-wp-gray-2 pb-2">{{ s.title }}</h2>
              <div class="grid gap-3">
                @for (c of s.controls; track c.key) {
                  <div>
                    @switch (c.type) {
                      @case ('checkbox') {
                        <label class="flex items-center gap-2 text-wp">
                          <input
                            type="checkbox"
                            class="accent-wp-blue"
                            [checked]="isOn(c.key)"
                            (change)="setChecked(c.key, $event)"
                          />
                          {{ c.label }}
                        </label>
                      }
                      @case ('color') {
                        <label class="wp-label" [for]="c.key">{{ c.label }}</label>
                        <div class="flex items-center gap-2">
                          <input
                            type="color"
                            class="h-8 w-12 cursor-pointer rounded border border-wp-border bg-white p-0.5"
                            [id]="c.key + '-color'"
                            [value]="str(c.key)"
                            (input)="set(c.key, $event)"
                          />
                          <input
                            class="wp-input w-32 font-mono"
                            [value]="str(c.key)"
                            (input)="set(c.key, $event)"
                            [attr.aria-label]="c.label + ' hex'"
                          />
                        </div>
                      }
                      @case ('select') {
                        <label class="wp-label" [for]="c.key">{{ c.label }}</label>
                        <select class="wp-input" [id]="c.key" [value]="str(c.key)" (change)="set(c.key, $event)">
                          @for (o of c.options ?? []; track o.value) {
                            <option [value]="o.value">{{ o.label }}</option>
                          }
                        </select>
                      }
                      @case ('textarea') {
                        <label class="wp-label" [for]="c.key">{{ c.label }}</label>
                        <textarea class="wp-input" rows="2" [id]="c.key" [value]="str(c.key)" (input)="set(c.key, $event)"></textarea>
                      }
                      @case ('number') {
                        <label class="wp-label" [for]="c.key">{{ c.label }}</label>
                        <input
                          type="number"
                          class="wp-input w-32"
                          [id]="c.key"
                          [value]="num(c.key)"
                          (input)="setNumber(c.key, $event)"
                        />
                      }
                      @case ('image') {
                        <label class="wp-label">{{ c.label }}</label>
                        <div class="flex items-center gap-2">
                          @if (str(c.key)) {
                            <img [src]="str(c.key)" alt="" class="size-10 rounded border border-wp-border object-cover" />
                          }
                          <input
                            class="wp-input flex-1"
                            placeholder="Image URL"
                            [value]="str(c.key)"
                            (input)="set(c.key, $event)"
                          />
                          <button type="button" class="wp-btn" (click)="pickImage(c.key)">Select</button>
                        </div>
                      }
                      @default {
                        <label class="wp-label" [for]="c.key">{{ c.label }}</label>
                        <input class="wp-input" [id]="c.key" [value]="str(c.key)" (input)="set(c.key, $event)" />
                      }
                    }
                  </div>
                }
              </div>
            </section>
          }
        </div>

        <!-- save panel -->
        <aside class="wp-box h-fit p-4 lg:sticky lg:top-12">
          <h3 class="mb-2">Save Changes</h3>
          <p class="mb-3 text-wp text-wp-muted">
            Customizer settings become CSS variables on the public site.
          </p>
          <div class="grid gap-2">
            <button type="button" class="wp-btn wp-btn-primary" [disabled]="busy()" (click)="save()">
              {{ busy() ? 'Saving…' : 'Save & Publish' }}
            </button>
            <button type="button" class="wp-btn" [disabled]="busy()" (click)="reset()">Reset to Defaults</button>
          </div>
          @if (savedAt()) {
            <p class="mt-2 text-wp-sm text-wp-green">Saved at {{ savedAt() }}</p>
          }
        </aside>
      </div>
    }
  `,
})
export class CustomizerPage {
  private api = inject(Api);
  private notify = inject(Notify);
  private dialog = inject(MatDialog);
  readonly env = environment;

  readonly theme = signal<ThemeState | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly savedAt = signal('');

  /** key → current value (strings/booleans/numbers per control type). */
  values: Record<string, unknown> = {};
  sections: Section[] = [];

  constructor() {
    this.api.get<ThemeState[]>('/themes').subscribe({
      next: (list) => {
        const active = list.find((t) => t.isActive) ?? list[0] ?? null;
        if (!active) {
          this.error.set('No themes installed.');
          return;
        }
        this.theme.set(active);
        this.values = { ...active.settings };
        this.sections = group(active.settingsSchema ?? []);
        // ensure every control has a value
        for (const c of active.settingsSchema ?? []) {
          if (!(c.key in this.values)) this.values[c.key] = c.default;
        }
      },
      error: (err: unknown) => {
        this.notify.error(err);
        this.error.set('Could not load themes.');
      },
    });
  }

  str(key: string): string {
    const v = this.values[key];
    return v === null || v === undefined ? '' : String(v);
  }

  num(key: string): number | string {
    const v = Number(this.values[key]);
    return Number.isFinite(v) ? v : '';
  }

  isOn(key: string): boolean {
    return this.values[key] === true;
  }

  set(key: string, event: Event): void {
    this.values[key] = (event.target as HTMLInputElement).value;
  }

  setNumber(key: string, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.values[key] = raw === '' ? '' : Number(raw);
  }

  setChecked(key: string, event: Event): void {
    this.values[key] = (event.target as HTMLInputElement).checked;
  }

  pickImage(key: string): void {
    const ref = this.dialog.open(MediaPickerDialog, {
      data: { title: 'Choose an image' },
      width: '860px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe((m) => {
      if (m) this.values[key] = this.api.abs(m.url);
    });
  }

  reset(): void {
    const t = this.theme();
    if (!t) return;
    for (const c of t.settingsSchema ?? []) this.values[c.key] = c.default;
    this.notify.ok('Defaults restored — press Save & Publish to apply');
  }

  save(): void {
    const t = this.theme();
    if (!t || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    // Only send keys the schema knows about (server validates too).
    const payload: Record<string, unknown> = {};
    for (const c of t.settingsSchema ?? []) payload[c.key] = this.values[c.key];
    this.api.patch<ThemeState>(`/themes/${t.id}/settings`, payload).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.theme.set(updated);
        this.values = { ...updated.settings };
        this.savedAt.set(new Date().toLocaleTimeString());
        this.notify.ok('Theme settings saved');
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.notify.error(err, 'Save failed');
        this.error.set('Some settings were rejected — check the values above.');
      },
    });
  }
}

function group(controls: ThemeSettingControl[]): Section[] {
  const map = new Map<string, Section>();
  for (const c of controls) {
    const id = c.section ?? 'general';
    let section = map.get(id);
    if (!section) {
      section = { id, title: SECTION_TITLES[id] ?? capitalize(id), controls: [] };
      map.set(id, section);
    }
    section.controls.push(c);
  }
  return [...map.values()];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
