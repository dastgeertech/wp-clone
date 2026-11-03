import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PublicOptions } from '@wp-clone/shared-types';
import { AuthService } from '../core/auth';
import { Api } from '../core/api';
import { environment } from '../../environments/environment';

/**
 * wp-admin chrome: black admin bar on top, dark menu sidebar, page outlet.
 * Menu entries are filtered by the signed-in user's capabilities.
 */
@Component({
  selector: 'wp-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <!-- admin bar -->
    <header class="sticky top-0 z-30 flex h-8 items-center justify-between bg-wp-ink px-2 text-wp text-white">
      <div class="flex items-center gap-3 min-w-0">
        <button
          type="button"
          class="md:hidden rounded p-1 hover:bg-white/10"
          (click)="open.update((v) => !v)"
          aria-label="Toggle menu"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
          </svg>
        </button>
        <a
          class="grid size-5 place-items-center rounded-full bg-white text-wp-ink text-[11px] font-bold"
          [href]="env.siteUrl"
          target="_blank"
          rel="noopener"
          title="Visit the site"
        >
          W
        </a>
        <a class="truncate hover:text-[#72aee6] hover:no-underline" [href]="env.siteUrl" target="_blank" rel="noopener">
          {{ siteName() }}
        </a>
      </div>
      <div class="flex items-center gap-3">
        <span class="hidden sm:inline text-white/70">Howdy, {{ auth.user()?.displayName }}</span>
        <span class="grid size-5 place-items-center rounded-full bg-wp-blue text-[10px] font-bold uppercase">
          {{ initial() }}
        </span>
        <button type="button" class="text-white/80 hover:text-white" (click)="auth.logout()">Log Out</button>
      </div>
    </header>

    <div class="flex min-h-[calc(100vh-2rem)]">
      <!-- sidebar -->
      <nav [class]="navClass()">
        <ul class="py-1">
          <li>
            <a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }" class="wp-menu-item" (click)="closeOnMobile()">
              <svg class="wp-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" stroke-linejoin="round"/></svg>
              Dashboard
            </a>
          </li>

          @if (auth.can('edit_posts')) {
            <li>
              <a routerLink="/posts" routerLinkActive="is-active" class="wp-menu-item" (click)="closeOnMobile()">
                <svg class="wp-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 3h9l4 4v14H6z" stroke-linejoin="round"/><path d="M9 11h7M9 15h7M9 7h4" stroke-linecap="round"/></svg>
                Posts
              </a>
            </li>
          }
          @if (auth.can('edit_pages')) {
            <li>
              <a routerLink="/pages" routerLinkActive="is-active" class="wp-menu-item" (click)="closeOnMobile()">
                <svg class="wp-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 3h7l4 4v14H7z" stroke-linejoin="round"/><path d="M10 12h5M10 16h5" stroke-linecap="round"/></svg>
                Pages
              </a>
            </li>
          }
          @if (auth.can('upload_files')) {
            <li>
              <a routerLink="/media" routerLinkActive="is-active" class="wp-menu-item" (click)="closeOnMobile()">
                <svg class="wp-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m6 16 4-4 3 3 2-2 3 3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="9.5" r="1.2"/></svg>
                Media
              </a>
            </li>
          }
          @if (auth.can('moderate_comments')) {
            <li>
              <a routerLink="/comments" routerLinkActive="is-active" class="wp-menu-item" (click)="closeOnMobile()">
                <svg class="wp-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2z" stroke-linejoin="round"/></svg>
                Comments
              </a>
            </li>
          }

          @if (appearanceVisible()) {
            <li class="mt-2 px-4 pt-3 pb-1 text-[11px] uppercase tracking-wide text-white/40">Appearance</li>
            @if (auth.can('switch_themes')) {
              <li>
                <a routerLink="/appearance/themes" routerLinkActive="is-active" class="wp-menu-item is-sub" (click)="closeOnMobile()">
                  <svg class="wp-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.4-2-.6-1 .2-2 1.3-2H17a4 4 0 0 0 4-4c0-5-4-10-9-10z" stroke-linejoin="round"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/></svg>
                  Themes
                </a>
              </li>
            }
            @if (auth.can('edit_theme_options')) {
              <li>
                <a routerLink="/appearance/customizer" routerLinkActive="is-active" class="wp-menu-item is-sub" (click)="closeOnMobile()">
                  <svg class="wp-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 6h14M5 12h14M5 18h14" stroke-linecap="round"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="8" cy="18" r="2" fill="currentColor" stroke="none"/></svg>
                  Customize
                </a>
              </li>
              <li>
                <a routerLink="/appearance/menus" routerLinkActive="is-active" class="wp-menu-item is-sub" (click)="closeOnMobile()">
                  <svg class="wp-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M4 12h10M4 17h13" stroke-linecap="round"/></svg>
                  Menus
                </a>
              </li>
            }
          }

          @if (auth.can('list_users')) {
            <li class="mt-2">
              <a routerLink="/users" routerLinkActive="is-active" class="wp-menu-item" (click)="closeOnMobile()">
                <svg class="wp-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5S13.7 16 14.5 19M16 5.5a3 3 0 0 1 0 5.6M17.5 14.7c2 .6 3.4 2.1 4 4.3" stroke-linecap="round"/></svg>
                Users
              </a>
            </li>
          }
          @if (auth.can('manage_options')) {
            <li>
              <a routerLink="/settings" routerLinkActive="is-active" class="wp-menu-item" (click)="closeOnMobile()">
                <svg class="wp-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" stroke-linecap="round"/></svg>
                Settings
              </a>
            </li>
          }
        </ul>
      </nav>

      <!-- page content -->
      <main class="min-w-0 flex-1 px-4 py-5 md:px-8">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .wp-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 12px;
      color: rgba(255, 255, 255, 0.85);
      font-size: 13px;
      text-decoration: none;
      border-left: 4px solid transparent;
    }
    .wp-menu-item.is-sub { padding-left: 30px; }
    .wp-menu-item:hover { background: rgba(255, 255, 255, 0.06); color: #72aee6; text-decoration: none; }
    .wp-menu-item.is-active {
      background: #2271b1;
      border-left-color: #fff;
      color: #fff;
      font-weight: 600;
    }
    .wp-menu-icon { width: 17px; height: 17px; flex-shrink: 0; opacity: 0.9; }
  `,
})
export class AdminLayout {
  readonly auth = inject(AuthService);
  private api = inject(Api);
  readonly env = environment;
  readonly open = signal(false);
  readonly siteName = signal('WP Clone');

  readonly initial = computed(() => (this.auth.user()?.displayName ?? '?').charAt(0));
  readonly appearanceVisible = computed(
    () => this.auth.can('switch_themes') || this.auth.can('edit_theme_options'),
  );
  readonly navClass = computed(() => {
    const base = 'w-44 shrink-0 bg-wp-ink text-white text-wp';
    return this.open()
      ? `${base} max-md:fixed max-md:z-20 max-md:top-8 max-md:bottom-0 max-md:shadow-2xl`
      : `${base} hidden md:block`;
  });

  constructor() {
    this.api
      .get<PublicOptions>('/options/public')
      .subscribe((o) => this.siteName.set(o.siteTitle || 'WP Clone'));
  }

  closeOnMobile(): void {
    this.open.set(false);
  }
}
