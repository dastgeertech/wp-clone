import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminPostSummary, Paged, PublicOptions } from '@wp-clone/shared-types';
import { Api } from '../core/api';
import { Notify } from '../core/notify';

type Options = Record<string, unknown>;

/** Settings → General / Reading / Discussion / SEO (`GET|PUT /options`). */
@Component({
  selector: 'wp-settings-page',
  imports: [FormsModule],
  template: `
    <h1>Settings</h1>

    @if (savedAt()) {
      <div class="wp-notice wp-notice-success">Settings saved at {{ savedAt() }}.</div>
    }

    <form class="grid max-w-3xl gap-5" (ngSubmit)="save()">
      <!-- General -->
      <section class="wp-box p-5">
        <h2 class="mb-4 border-b border-wp-gray-2 pb-2 text-wp-lg font-normal">General</h2>
        <div class="grid gap-4">
          <div>
            <label class="wp-label" for="siteTitle">Site Title</label>
            <input id="siteTitle" class="wp-input" [(ngModel)]="form.siteTitle" name="siteTitle" />
          </div>
          <div>
            <label class="wp-label" for="tagline">Tagline</label>
            <input id="tagline" class="wp-input" [(ngModel)]="form.tagline" name="tagline" />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="wp-label" for="siteUrl">WordPress Address (URL)</label>
              <input id="siteUrl" class="wp-input" [(ngModel)]="form.siteUrl" name="siteUrl" />
            </div>
            <div>
              <label class="wp-label" for="adminEmail">Administration Email</label>
              <input id="adminEmail" type="email" class="wp-input" [(ngModel)]="form.adminEmail" name="adminEmail" />
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            <div>
              <label class="wp-label" for="language">Site Language</label>
              <select id="language" class="wp-input" [(ngModel)]="form.language" name="language">
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="ar">العربية</option>
              </select>
            </div>
            <div>
              <label class="wp-label" for="dateFormat">Date Format</label>
              <select id="dateFormat" class="wp-input" [(ngModel)]="form.dateFormat" name="dateFormat">
                <option value="F j, Y">November 3, 2026</option>
                <option value="Y-m-d">2026-11-03</option>
                <option value="m/d/Y">11/03/2026</option>
                <option value="d/m/Y">03/11/2026</option>
              </select>
            </div>
            <div>
              <label class="wp-label" for="startOfWeek">Start of Week</label>
              <select id="startOfWeek" class="wp-input" [(ngModel)]="form.startOfWeek" name="startOfWeek">
                <option [ngValue]="0">Sunday</option>
                <option [ngValue]="1">Monday</option>
                <option [ngValue]="2">Tuesday</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <!-- Reading -->
      <section class="wp-box p-5">
        <h2 class="mb-4 border-b border-wp-gray-2 pb-2 text-wp-lg font-normal">Reading</h2>
        <div class="grid gap-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="wp-label" for="postsPerPage">Blog pages show at most</label>
              <div class="flex items-center gap-2">
                <input
                  id="postsPerPage"
                  type="number"
                  min="1"
                  max="100"
                  class="wp-input w-24"
                  [(ngModel)]="form.postsPerPage"
                  name="postsPerPage"
                />
                <span class="text-wp text-wp-muted">posts</span>
              </div>
            </div>
            <div>
              <label class="wp-label" for="homepageDisplays">Homepage displays</label>
              <select id="homepageDisplays" class="wp-input" [(ngModel)]="form.homepageDisplays" name="homepageDisplays">
                <option value="posts">Your latest posts</option>
                <option value="page">A static page</option>
              </select>
            </div>
          </div>
          @if (form.homepageDisplays === 'page') {
            <div>
              <label class="wp-label" for="homepageId">Homepage</label>
              <select id="homepageId" class="wp-input" [(ngModel)]="form.homepageId" name="homepageId">
                <option value="">— Select a page —</option>
                @for (p of pages(); track p.id) {
                  <option [value]="p.id">{{ p.title }}</option>
                }
              </select>
            </div>
          }
          <div>
            <label class="wp-label" for="permalink">Permalink structure</label>
            <input id="permalink" class="wp-input font-mono" value="/%postname%/" readonly />
            <p class="mt-1 text-wp-sm text-wp-muted">
              Pretty permalinks are always on — post URLs look like <code class="bg-wp-gray-2 px-1">/hello-world/</code>.
            </p>
          </div>
        </div>
      </section>

      <!-- Discussion -->
      <section class="wp-box p-5">
        <h2 class="mb-4 border-b border-wp-gray-2 pb-2 text-wp-lg font-normal">Discussion</h2>
        <div class="grid gap-3">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="wp-label" for="defaultCommentStatus">Default post status</label>
              <select id="defaultCommentStatus" class="wp-input" [(ngModel)]="form.defaultCommentStatus" name="defaultCommentStatus">
                <option value="OPEN">Comments open</option>
                <option value="CLOSED">Comments closed</option>
              </select>
            </div>
          </div>
          <label class="flex items-center gap-2 text-wp">
            <input type="checkbox" class="accent-wp-blue" [(ngModel)]="form.commentsRequireApproval" name="commentsRequireApproval" />
            Comment must be manually approved
          </label>
        </div>
      </section>

      <!-- SEO -->
      <section class="wp-box p-5">
        <h2 class="mb-4 border-b border-wp-gray-2 pb-2 text-wp-lg font-normal">Search Engine Optimization</h2>
        <div class="grid gap-4">
          <div>
            <label class="wp-label" for="seoTemplate">Title format</label>
            <input id="seoTemplate" class="wp-input font-mono" [(ngModel)]="form.seoDefaultTitleTemplate" name="seoDefaultTitleTemplate" />
            <p class="mt-1 text-wp-sm text-wp-muted">Tokens: <code class="bg-wp-gray-2 px-1">%title%</code> <code class="bg-wp-gray-2 px-1">%site%</code> <code class="bg-wp-gray-2 px-1">%tagline%</code></p>
          </div>
          <label class="flex items-center gap-2 text-wp">
            <input type="checkbox" class="accent-wp-blue" [(ngModel)]="form.seoNoIndexSite" name="seoNoIndexSite" />
            Discourage search engines from indexing this site
          </label>
          @if (form.seoNoIndexSite) {
            <p class="wp-notice wp-notice-error mb-0">⚠ The whole site is set to noindex — search engines will skip it.</p>
          }
        </div>
      </section>

      <div>
        <button type="submit" class="wp-btn wp-btn-primary px-6 py-1.5" [disabled]="busy()">
          {{ busy() ? 'Saving…' : 'Save Changes' }}
        </button>
      </div>
    </form>
  `,
})
export class SettingsPage {
  private api = inject(Api);
  private notify = inject(Notify);

  readonly busy = signal(false);
  readonly savedAt = signal('');
  readonly pages = signal<AdminPostSummary[]>([]);

  form: {
    siteTitle: string;
    tagline: string;
    siteUrl: string;
    adminEmail: string;
    language: string;
    dateFormat: string;
    startOfWeek: number;
    postsPerPage: number;
    homepageDisplays: 'posts' | 'page';
    homepageId: string;
    defaultCommentStatus: 'OPEN' | 'CLOSED';
    commentsRequireApproval: boolean;
    seoDefaultTitleTemplate: string;
    seoNoIndexSite: boolean;
  } = {
    siteTitle: '',
    tagline: '',
    siteUrl: '',
    adminEmail: '',
    language: 'en',
    dateFormat: 'F j, Y',
    startOfWeek: 1,
    postsPerPage: 10,
    homepageDisplays: 'posts',
    homepageId: '',
    defaultCommentStatus: 'OPEN',
    commentsRequireApproval: true,
    seoDefaultTitleTemplate: '%title% | %site%',
    seoNoIndexSite: false,
  };

  constructor() {
    this.api.get<Options>('/options').subscribe({
      next: (opts) => this.populate(opts),
      error: (err: unknown) => this.notify.error(err),
    });
    this.api.get<Paged<AdminPostSummary>>('/posts', { type: 'PAGE', perPage: 100 }).subscribe({
      next: (res) => this.pages.set(res.items),
      error: () => undefined, // editors without page access just get the plain select
    });
  }

  private populate(opts: Options): void {
    const str = (k: string, fallback = '') => (typeof opts[k] === 'string' ? (opts[k] as string) : fallback);
    this.form = {
      siteTitle: str('siteTitle'),
      tagline: str('tagline'),
      siteUrl: str('siteUrl'),
      adminEmail: str('adminEmail'),
      language: str('language', 'en'),
      dateFormat: str('dateFormat', 'F j, Y'),
      startOfWeek: Number(opts['startOfWeek'] ?? 1),
      postsPerPage: Number(opts['postsPerPage'] ?? 10),
      homepageDisplays: str('homepageDisplays', 'posts') === 'page' ? 'page' : 'posts',
      homepageId: opts['homepageId'] ? String(opts['homepageId']) : '',
      defaultCommentStatus: str('defaultCommentStatus', 'OPEN') === 'CLOSED' ? 'CLOSED' : 'OPEN',
      commentsRequireApproval: opts['commentsRequireApproval'] !== false,
      seoDefaultTitleTemplate: str('seoDefaultTitleTemplate', '%title% | %site%'),
      seoNoIndexSite: opts['seoNoIndexSite'] === true,
    };
  }

  save(): void {
    if (this.busy()) return;
    this.busy.set(true);
    const payload: PublicOptions & Record<string, unknown> = {
      siteTitle: this.form.siteTitle.trim(),
      tagline: this.form.tagline.trim(),
      siteUrl: this.form.siteUrl.trim(),
      language: this.form.language,
      postsPerPage: Math.max(1, Number(this.form.postsPerPage) || 10),
      homepageDisplays: this.form.homepageDisplays,
      homepageId: this.form.homepageDisplays === 'page' && this.form.homepageId ? this.form.homepageId : null,
      defaultCommentStatus: this.form.defaultCommentStatus,
      commentsRequireApproval: this.form.commentsRequireApproval,
      seoDefaultTitleTemplate: this.form.seoDefaultTitleTemplate.trim(),
      seoNoIndexSite: this.form.seoNoIndexSite,
      adminEmail: this.form.adminEmail.trim(),
      dateFormat: this.form.dateFormat,
      startOfWeek: Number(this.form.startOfWeek) || 0,
    };
    this.api.put<Options>('/options', payload).subscribe({
      next: (opts) => {
        this.busy.set(false);
        this.populate(opts);
        this.savedAt.set(new Date().toLocaleTimeString());
        this.notify.ok('Settings saved');
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.notify.error(err, 'Save failed');
      },
    });
  }
}
