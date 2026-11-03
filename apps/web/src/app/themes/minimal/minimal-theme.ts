import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommentFormComponent } from '../../ui/comment-form';
import { CommentListComponent } from '../../ui/comment-list';
import { NavMenuComponent } from '../../ui/nav-menu';
import { PaginationComponent } from '../../ui/pagination';
import { ResponsiveImageComponent } from '../../ui/responsive-image';
import { SearchFormComponent } from '../../ui/search-form';
import { ThemeBase } from '../theme-base';

/**
 * WP Clone Minimal — a crisp magazine layout: tight typography, category
 * rules and an optional sticky sidebar (position from the customizer).
 */
@Component({
  selector: 'wp-minimal-theme',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    RouterModule,
    NavMenuComponent,
    SearchFormComponent,
    PaginationComponent,
    ResponsiveImageComponent,
    CommentListComponent,
    CommentFormComponent,
  ],
  template: `
    <div [style]="cssVars()" class="min-h-screen flex flex-col">
      @let d = data();
      <!-- Header -->
      <header class="border-b-2" style="border-color: var(--wp-primary)">
        <div class="mx-auto max-w-6xl px-4">
          <div class="flex items-center justify-between gap-4 py-4">
            <a href="/" class="text-2xl font-black tracking-tighter uppercase">
              @if (logoUrl()) {
                <img [src]="logoUrl()" [alt]="siteTitle()" class="h-9" />
              } @else {
                {{ siteTitle() }}
              }
            </a>
            <div class="w-52 hidden sm:block">
              <wp-search-form
                inputClass="w-full rounded border px-3 py-1.5 text-sm bg-transparent"
                buttonClass="shrink-0 rounded px-3 py-1.5 text-sm font-bold text-white"
              />
            </div>
          </div>
          <nav class="border-t py-2" aria-label="Primary"
               style="border-color: color-mix(in srgb, var(--wp-text) 12%, var(--wp-bg))">
            @if (primaryMenu(); as menu) {
              <wp-nav-menu [items]="menu.items"
                           listClass="flex flex-wrap gap-x-6 gap-y-1 text-sm font-semibold uppercase tracking-wide" />
            }
          </nav>
        </div>
      </header>

      <!-- Main -->
      <main class="flex-1 mx-auto w-full max-w-6xl px-4 py-10">
        @switch (d.kind) {
          @case ('home') {
            @if (d.staticPage; as page) {
              <article class="max-w-3xl">
                <h1 class="text-4xl font-black tracking-tight mb-6">{{ page.title }}</h1>
                <div class="wp-prose" [innerHTML]="page.contentHtml"></div>
              </article>
            } @else {
            <div class="grid gap-12" [class]="showSidebar() ? 'lg:grid-cols-3' : ''">
              <div class="min-w-0" [class.lg:col-span-2]="showSidebar()">
                  <div class="space-y-10">
                    @for (post of d.posts.items; track post.id; let i = $index) {
                      <article class="flex gap-5 items-start pb-10 border-b"
                               [class.border-b]="!$last"
                               [style.border-color]="!$last ? 'color-mix(in srgb, var(--wp-text) 12%, var(--wp-bg))' : null">
                        @if (post.featuredImage) {
                          <a [href]="post.url" class="w-40 shrink-0 aspect-[4/3] overflow-hidden hidden sm:block"
                             tabindex="-1" aria-hidden="true">
                            <wp-image [media]="post.featuredImage" [eager]="i === 0"
                                      [sizes]="'160px'" imgClass="w-full h-full object-cover" />
                          </a>
                        }
                        <div class="min-w-0">
                          @if (post.categories.length) {
                            <p class="flex flex-wrap gap-2 mb-1 text-[11px] font-bold uppercase tracking-widest">
                              @for (c of post.categories.slice(0, 2); track c.id) {
                                <a [href]="'/category/' + c.slug + '/'"
                                   [style.color]="showCategoryColors() ? categoryColor(c.slug) : 'var(--wp-accent)'"
                                   class="hover:underline">
                                  {{ c.name }}
                                </a>
                              }
                            </p>
                          }
                          <h2 [class.text-3xl]="i === 0" [class.text-xl]="i !== 0"
                              class="font-extrabold leading-tight mb-1">
                            <a [href]="post.url" class="hover:underline underline-offset-4">{{ post.title }}</a>
                          </h2>
                          <p class="text-xs opacity-60 mb-2">
                            {{ post.publishedAt | date: 'MMM d, y' }} · {{ post.author.displayName }}
                            @if (post.commentCount) { · {{ post.commentCount }} comment{{ post.commentCount === 1 ? '' : 's' }} }
                          </p>
                          @if (post.excerpt) {
                            <p class="text-sm opacity-80 leading-relaxed line-clamp-3">{{ post.excerpt }}</p>
                          }
                        </div>
                      </article>
                    } @empty {
                      <p class="text-center opacity-70 py-16">No posts yet.</p>
                    }
                  </div>
                  <wp-pagination
                    [page]="d.posts.page"
                    [total]="d.posts.total"
                    [perPage]="d.posts.perPage"
                    basePath="/"
                  />
                </div>
                @if (showSidebar()) {
                  <aside [class.lg:order-first]="sidebarPosition() === 'left'"
                         class="space-y-8 lg:sticky lg:top-24 lg:self-start">
                    <ng-container *ngTemplateOutlet="sidebarTpl" />
                  </aside>
                }
              </div>
            }
          }
          @case ('post') {
            <div class="grid gap-12 lg:grid-cols-3">
              <article class="min-w-0" [class.lg:col-span-2]="showSidebar()">
                <header class="mb-6">
                  @if (d.post.categories.length) {
                    <p class="flex flex-wrap gap-2 mb-2 text-[11px] font-bold uppercase tracking-widest">
                      @for (c of d.post.categories; track c.id) {
                        <a [href]="'/category/' + c.slug + '/'"
                           [style.color]="showCategoryColors() ? categoryColor(c.slug) : 'var(--wp-accent)'"
                           class="hover:underline">
                          {{ c.name }}
                        </a>
                      }
                    </p>
                  }
                  <h1 class="text-4xl font-black tracking-tight leading-tight">{{ d.post.title }}</h1>
                  <p class="mt-3 text-sm opacity-60">
                    <time [attr.datetime]="d.post.publishedAt ?? undefined">
                      {{ d.post.publishedAt | date: 'MMMM d, y' }}
                    </time>
                    · <a [href]="'/author/' + d.post.author.slug + '/'" class="hover:underline">
                      {{ d.post.author.displayName }}
                    </a>
                  </p>
                </header>
                @if (d.post.featuredImage) {
                  <figure class="mb-8">
                    <wp-image [media]="d.post.featuredImage" [eager]="true"
                              [sizes]="'(min-width: 1024px) 66vw, 100vw'" />
                  </figure>
                }
                <div class="wp-prose" [innerHTML]="d.post.contentHtml"></div>
                @if (d.post.tags.length) {
                  <p class="mt-8 flex flex-wrap gap-2">
                    @for (t of d.post.tags; track t.id) {
                      <a [href]="'/tag/' + t.slug + '/'"
                         class="px-3 py-1 text-sm border"
                         style="border-color: color-mix(in srgb, var(--wp-text) 25%, var(--wp-bg))">
                        #{{ t.name }}
                      </a>
                    }
                  </p>
                }
              </article>
              @if (showSidebar()) {
                <aside [class.lg:order-first]="sidebarPosition() === 'left'"
                       class="space-y-8 lg:sticky lg:top-24 lg:self-start">
                  <ng-container *ngTemplateOutlet="sidebarTpl" />
                </aside>
              }
            </div>

            <section id="comments" class="max-w-3xl mt-14 pt-8 border-t"
                     [style.border-color]="showSidebar() ? 'transparent' : 'color-mix(in srgb, var(--wp-text) 12%, var(--wp-bg))'"
                     [class.mx-auto]="!showSidebar()"
                     [class.lg:mx-0]="showSidebar()"
                     [style.max-width]="showSidebar() ? null : '48rem'">
              <h2 class="text-2xl font-black mb-6">
                {{ d.post.commentCount }} Comment{{ d.post.commentCount === 1 ? '' : 's' }}
              </h2>
              <wp-comment-list [comments]="d.comments" />
              @if (d.post.commentStatus === 'OPEN') {
                <div class="mt-10">
                  <h3 class="text-lg font-bold mb-4 uppercase tracking-wide">Leave a Reply</h3>
                  <wp-comment-form [postId]="d.post.id" />
                </div>
              } @else {
                <p class="mt-8 opacity-70 italic">Comments are closed.</p>
              }
            </section>
          }
          @case ('page') {
            <article class="max-w-3xl">
              <h1 class="text-4xl font-black tracking-tight mb-8">{{ d.page.title }}</h1>
              <div class="wp-prose" [innerHTML]="d.page.contentHtml"></div>
            </article>
          }
          @case ('archive') {
            <header class="mb-10 max-w-6xl">
              <p class="text-[11px] uppercase tracking-widest opacity-60 mb-1">
                {{ d.taxonomy === 'CATEGORY' ? 'Category' : 'Tag' }}
              </p>
              <h1 class="text-4xl font-black tracking-tight">{{ d.term.name }}</h1>
              @if (d.term.description) {
                <p class="mt-2 opacity-70">{{ d.term.description }}</p>
              }
            </header>
            <div class="grid gap-12 lg:grid-cols-3">
              <div class="min-w-0 space-y-10" [class.lg:col-span-2]="showSidebar()">
                @for (post of d.posts.items; track post.id; let i = $index) {
                  <article class="pb-10 border-b"
                           [style.border-color]="!$last ? 'color-mix(in srgb, var(--wp-text) 12%, var(--wp-bg))' : null">
                    @if (post.featuredImage) {
                      <a [href]="post.url" class="block mb-4 aspect-[16/9] overflow-hidden" tabindex="-1" aria-hidden="true">
                        <wp-image [media]="post.featuredImage" [eager]="i === 0"
                                  [sizes]="'(min-width: 1024px) 66vw, 100vw'"
                                  imgClass="w-full h-full object-cover" />
                      </a>
                    }
                    <h2 class="text-2xl font-extrabold leading-tight mb-1">
                      <a [href]="post.url" class="hover:underline underline-offset-4">{{ post.title }}</a>
                    </h2>
                    <p class="text-xs opacity-60 mb-2">{{ post.publishedAt | date: 'MMM d, y' }} · {{ post.author.displayName }}</p>
                    @if (post.excerpt) {
                      <p class="text-sm opacity-80 leading-relaxed">{{ post.excerpt }}</p>
                    }
                  </article>
                } @empty {
                  <p class="text-center opacity-70 py-16">Nothing here yet.</p>
                }
                <wp-pagination
                  [page]="d.posts.page"
                  [total]="d.posts.total"
                  [perPage]="d.posts.perPage"
                  [basePath]="(d.taxonomy === 'CATEGORY' ? '/category/' : '/tag/') + d.term.slug + '/'"
                />
              </div>
              @if (showSidebar()) {
                <aside [class.lg:order-first]="sidebarPosition() === 'left'"
                       class="space-y-8 lg:sticky lg:top-24 lg:self-start">
                  <ng-container *ngTemplateOutlet="sidebarTpl" />
                </aside>
              }
            </div>
          }
          @case ('author') {
            <header class="mb-10 max-w-6xl">
              @if (d.author.avatar) {
                <wp-image [media]="d.author.avatar" class="w-20 mb-3"
                          imgClass="rounded-full" sizes="80px" />
              }
              <h1 class="text-4xl font-black tracking-tight">{{ d.author.displayName }}</h1>
              @if (d.author.bio) {
                <p class="mt-2 opacity-70 max-w-xl">{{ d.author.bio }}</p>
              }
            </header>
            <div class="max-w-3xl space-y-10">
              @for (post of d.posts.items; track post.id; let i = $index) {
                <article class="pb-10 border-b"
                         [style.border-color]="!$last ? 'color-mix(in srgb, var(--wp-text) 12%, var(--wp-bg))' : null">
                  <h2 class="text-2xl font-extrabold leading-tight mb-1">
                    <a [href]="post.url" class="hover:underline underline-offset-4">{{ post.title }}</a>
                  </h2>
                  <p class="text-xs opacity-60 mb-2">{{ post.publishedAt | date: 'MMM d, y' }}</p>
                  @if (post.excerpt) {
                    <p class="text-sm opacity-80 leading-relaxed">{{ post.excerpt }}</p>
                  }
                </article>
              } @empty {
                <p class="text-center opacity-70 py-16">No posts by this author yet.</p>
              }
              <wp-pagination
                [page]="d.posts.page"
                [total]="d.posts.total"
                [perPage]="d.posts.perPage"
                [basePath]="'/author/' + d.author.slug + '/'"
              />
            </div>
          }
          @case ('search') {
            <header class="mb-10 max-w-6xl">
              <h1 class="text-3xl font-black tracking-tight">
                @if (d.q) {
                  Results for <span style="color: var(--wp-accent)">“{{ d.q }}”</span>
                } @else {
                  Search
                }
              </h1>
              <p class="mt-2 text-sm opacity-60">{{ d.posts.total }} result{{ d.posts.total === 1 ? '' : 's' }}</p>
              <div class="mt-5 max-w-md">
                <wp-search-form [placeholder]="d.q || 'Search…'" />
              </div>
            </header>
            <div class="max-w-3xl space-y-10">
              @for (post of d.posts.items; track post.id; let i = $index) {
                <article class="pb-10 border-b"
                         [style.border-color]="!$last ? 'color-mix(in srgb, var(--wp-text) 12%, var(--wp-bg))' : null">
                  <h2 class="text-2xl font-extrabold leading-tight mb-1">
                    <a [href]="post.url" class="hover:underline underline-offset-4">{{ post.title }}</a>
                  </h2>
                  <p class="text-xs opacity-60 mb-2">{{ post.publishedAt | date: 'MMM d, y' }} · {{ post.author.displayName }}</p>
                  @if (post.excerpt) {
                    <p class="text-sm opacity-80 leading-relaxed">{{ post.excerpt }}</p>
                  }
                </article>
              } @empty {
                @if (d.q) {
                  <p class="text-center opacity-70 py-16">Nothing matched your search.</p>
                }
              }
              <wp-pagination
                [page]="d.posts.page"
                [total]="d.posts.total"
                [perPage]="d.posts.perPage"
                basePath="/search"
                [query]="'q=' + d.q"
              />
            </div>
          }
          @case ('notfound') {
            <div class="text-center py-24 max-w-xl mx-auto">
              <p class="text-8xl font-black opacity-20">404</p>
              <h1 class="text-3xl font-black mt-4">Page not found</h1>
              <p class="mt-3 opacity-70">The page you were looking for doesn’t exist or has been moved.</p>
              <div class="mt-8">
                <wp-search-form />
              </div>
              <a href="/" class="inline-block mt-6 font-bold" style="color: var(--wp-accent)">
                ← Back to home
              </a>
            </div>
          }
        }
      </main>

      <!-- Footer -->
      <footer class="border-t-2 mt-12 py-8 px-4" style="border-color: var(--wp-primary)">
        <div class="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          @if (footerMenu(); as menu) {
            <nav aria-label="Footer">
              <wp-nav-menu [items]="menu.items"
                           listClass="flex flex-wrap gap-x-5 gap-y-1 font-semibold uppercase tracking-wide" />
            </nav>
          }
          <p class="opacity-70">
            {{ footerText() }} · © {{ year() }} {{ siteTitle() }}
          </p>
        </div>
      </footer>
    </div>

    <!-- Reusable sidebar -->
    <ng-template #sidebarTpl>
      <section>
        <h2 class="text-[11px] font-bold uppercase tracking-widest mb-3 pb-2 border-b"
            style="border-color: color-mix(in srgb, var(--wp-text) 15%, var(--wp-bg))">
          Categories
        </h2>
        <ul class="space-y-1.5 text-sm">
          @for (c of categories(); track c.id) {
            <li class="flex justify-between gap-2">
              <a [href]="'/category/' + c.slug + '/'"
                 [style.color]="showCategoryColors() ? categoryColor(c.slug) : null"
                 class="hover:underline">
                {{ c.name }}
              </a>
              <span class="opacity-50">{{ c.postCount }}</span>
            </li>
          }
        </ul>
      </section>
      <section>
        <h2 class="text-[11px] font-bold uppercase tracking-widest mb-3 pb-2 border-b"
            style="border-color: color-mix(in srgb, var(--wp-text) 15%, var(--wp-bg))">
          Search
        </h2>
        <wp-search-form
          inputClass="w-full rounded border px-3 py-2 text-sm bg-transparent"
          buttonClass="shrink-0 rounded px-3 py-2 text-sm font-bold text-white"
        />
      </section>
      @if (site(); as s) {
        <section>
          <h2 class="text-[11px] font-bold uppercase tracking-widest mb-3 pb-2 border-b"
              style="border-color: color-mix(in srgb, var(--wp-text) 15%, var(--wp-bg))">
            About
          </h2>
          <p class="text-sm opacity-75">{{ s.options.tagline }}</p>
        </section>
      }
    </ng-template>
  `,
})
export class MinimalTheme extends ThemeBase {
  readonly showSidebar = this.boolSetting('showSidebar', true);
  readonly sidebarPosition = this.textSetting('sidebarPosition', 'right');
  readonly showCategoryColors = this.boolSetting('showCategoryColors', true);

  /** Deterministic category color from its slug (stable across renders). */
  categoryColor(slug: string): string {
    let hash = 0;
    for (let i = 0; i < slug.length; i++) {
      hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
    }
    const hue = hash % 360;
    return `hsl(${hue} 65% 42%)`;
  }

  private textSetting(key: string, fallback: string) {
    return computed(() => {
      const v = this.settings()[key];
      return typeof v === 'string' && v ? v : fallback;
    });
  }

  private boolSetting(key: string, fallback: boolean) {
    return computed(() => {
      const v = this.settings()[key];
      return v === undefined || v === null ? fallback : Boolean(v);
    });
  }
}
