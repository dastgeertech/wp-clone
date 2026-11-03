import { DatePipe } from '@angular/common';
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
 * WP Clone Modern — bold full-width theme with a dark hero area and a
 * responsive card grid. Dark surfaces derive from `--wp-primary`.
 */
@Component({
  selector: 'wp-modern-theme',
  imports: [
    DatePipe,
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
      <header class="sticky top-0 z-30 backdrop-blur" style="background: color-mix(in srgb, var(--wp-primary) 92%, transparent)">
        <div class="mx-auto max-w-6xl px-4 h-16 flex items-center gap-6">
          <a href="/" class="flex items-center gap-2 font-extrabold text-lg text-white shrink-0">
            @if (logoUrl()) {
              <img [src]="logoUrl()" [alt]="siteTitle()" class="h-8" />
            } @else {
              {{ siteTitle() }}
            }
          </a>
          <nav class="flex-1 hidden md:block" aria-label="Primary">
            @if (primaryMenu(); as menu) {
              <wp-nav-menu [items]="menu.items"
                           listClass="flex flex-wrap gap-1 text-white/90" />
            }
          </nav>
          <div class="ml-auto w-44">
            <wp-search-form
              formClass="flex gap-2"
              inputClass="w-full rounded-full border border-white/30 bg-white/10 text-white placeholder-white/60 px-3 py-1.5 text-sm"
              buttonClass="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-white"
            />
          </div>
        </div>
        @if (primaryMenu(); as menu) {
          <nav class="md:hidden px-4 pb-3" aria-label="Primary mobile">
            <wp-nav-menu [items]="menu.items" listClass="flex flex-wrap gap-1 text-white/90 text-sm" />
          </nav>
        }
      </header>

      <!-- Hero (home only, when enabled) -->
      @if (d.kind === 'home' && heroEnabled() && !d.staticPage) {
        <section class="text-white py-20 px-4" style="background: linear-gradient(135deg, var(--wp-primary), color-mix(in srgb, var(--wp-primary) 70%, var(--wp-accent)))">
          <div class="mx-auto max-w-3xl text-center">
            <h1 class="text-5xl font-extrabold tracking-tight">{{ heroTitle() }}</h1>
            @if (heroSubtitle()) {
              <p class="mt-4 text-lg text-white/80">{{ heroSubtitle() }}</p>
            }
            <div class="mt-8 max-w-xl mx-auto">
              <wp-search-form
                inputClass="w-full rounded-full border border-white/30 bg-white/10 text-white placeholder-white/60 px-5 py-3"
                buttonClass="shrink-0 rounded-full px-5 py-3 font-semibold text-white"
              />
            </div>
          </div>
        </section>
      }

      <!-- Main -->
      <main class="flex-1 mx-auto w-full max-w-6xl px-4 py-12">
        @switch (d.kind) {
          @case ('home') {
            @if (d.staticPage; as page) {
              <article class="max-w-3xl mx-auto">
                <h1 class="text-4xl font-extrabold mb-6">{{ page.title }}</h1>
                <div class="wp-prose" [innerHTML]="page.contentHtml"></div>
              </article>
            } @else {
              <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                @for (post of d.posts.items; track post.id; let i = $index) {
                  <article class="group rounded-2xl overflow-hidden transition-shadow hover:shadow-2xl"
                           [class.shadow-lg]="cardStyle() === 'elevated'"
                           [class.border]="cardStyle() === 'outlined'"
                           [style.border-color]="cardStyle() === 'outlined' ? 'color-mix(in srgb, var(--wp-text) 15%, var(--wp-bg))' : null"
                           [class.bg-transparent]="cardStyle() !== 'elevated'">
                    @if (post.featuredImage) {
                      <a [href]="post.url" class="block aspect-[16/10] overflow-hidden" tabindex="-1" aria-hidden="true">
                        <wp-image [media]="post.featuredImage" [eager]="i === 0"
                                  [sizes]="'(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'"
                                  imgClass="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      </a>
                    }
                    <div class="p-6">
                      @if (post.categories.length) {
                        <p class="flex flex-wrap gap-2 mb-2 text-xs font-bold uppercase tracking-wider">
                          @for (c of post.categories.slice(0, 2); track c.id) {
                            <a [href]="'/category/' + c.slug + '/'" style="color: var(--wp-accent)" class="hover:underline">
                              {{ c.name }}
                            </a>
                          }
                        </p>
                      }
                      <h2 class="text-xl font-bold leading-snug mb-2">
                        <a [href]="post.url" class="hover:underline underline-offset-4">{{ post.title }}</a>
                      </h2>
                      <p class="text-sm opacity-70 mb-3">
                        {{ post.publishedAt | date: 'MMM d, y' }} · {{ post.author.displayName }}
                      </p>
                      @if (post.excerpt) {
                        <p class="text-sm opacity-80 leading-relaxed">{{ post.excerpt }}</p>
                      }
                      <a [href]="post.url" class="inline-block mt-4 text-sm font-bold hover:underline"
                         style="color: var(--wp-accent)">
                        Read more →
                      </a>
                    </div>
                  </article>
                } @empty {
                  <p class="col-span-full text-center opacity-70 py-16">No posts yet.</p>
                }
              </div>
              <wp-pagination
                [page]="d.posts.page"
                [total]="d.posts.total"
                [perPage]="d.posts.perPage"
                basePath="/"
              />
            }
          }
          @case ('post') {
            <article class="max-w-3xl mx-auto">
              @if (d.post.featuredImage) {
                <figure class="mb-8 rounded-2xl overflow-hidden">
                  <wp-image [media]="d.post.featuredImage" [eager]="true"
                            [sizes]="'(min-width: 1024px) 768px, 100vw'" />
                </figure>
              }
              <header class="mb-8">
                @if (d.post.categories.length) {
                  <p class="flex flex-wrap gap-2 mb-3 text-xs font-bold uppercase tracking-wider">
                    @for (c of d.post.categories; track c.id) {
                      <a [href]="'/category/' + c.slug + '/'" style="color: var(--wp-accent)" class="hover:underline">
                        {{ c.name }}
                      </a>
                    }
                  </p>
                }
                <h1 class="text-4xl font-extrabold leading-tight">{{ d.post.title }}</h1>
                <p class="mt-4 text-sm opacity-70">
                  <time [attr.datetime]="d.post.publishedAt ?? undefined">
                    {{ d.post.publishedAt | date: 'MMMM d, y' }}
                  </time>
                  · <a [href]="'/author/' + d.post.author.slug + '/'" class="hover:underline">
                    {{ d.post.author.displayName }}
                  </a>
                </p>
              </header>
              <div class="wp-prose" [innerHTML]="d.post.contentHtml"></div>

              @if (d.post.tags.length) {
                <p class="mt-8 flex flex-wrap gap-2">
                  @for (t of d.post.tags; track t.id) {
                    <a [href]="'/tag/' + t.slug + '/'"
                       class="px-3 py-1 text-sm rounded-full border"
                       style="border-color: color-mix(in srgb, var(--wp-text) 25%, var(--wp-bg))">
                      #{{ t.name }}
                    </a>
                  }
                </p>
              }
            </article>

            <section id="comments" class="max-w-3xl mx-auto mt-14 pt-8 border-t"
                     style="border-color: color-mix(in srgb, var(--wp-text) 15%, var(--wp-bg))">
              <h2 class="text-2xl font-bold mb-6">
                {{ d.post.commentCount }} Comment{{ d.post.commentCount === 1 ? '' : 's' }}
              </h2>
              <wp-comment-list [comments]="d.comments" />
              @if (d.post.commentStatus === 'OPEN') {
                <div class="mt-10">
                  <h3 class="text-xl font-bold mb-4">Leave a Reply</h3>
                  <wp-comment-form [postId]="d.post.id" />
                </div>
              } @else {
                <p class="mt-8 opacity-70 italic">Comments are closed.</p>
              }
            </section>
          }
          @case ('page') {
            <article class="max-w-3xl mx-auto">
              <h1 class="text-4xl font-extrabold mb-8">{{ d.page.title }}</h1>
              <div class="wp-prose" [innerHTML]="d.page.contentHtml"></div>
            </article>
          }
          @case ('archive') {
            <header class="mb-10 max-w-6xl mx-auto text-center">
              <p class="text-xs uppercase tracking-widest opacity-60 mb-2">
                {{ d.taxonomy === 'CATEGORY' ? 'Category' : 'Tag' }}
              </p>
              <h1 class="text-4xl font-extrabold">{{ d.term.name }}</h1>
              @if (d.term.description) {
                <p class="mt-3 opacity-70">{{ d.term.description }}</p>
              }
            </header>
            <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              @for (post of d.posts.items; track post.id; let i = $index) {
                <article class="rounded-2xl overflow-hidden"
                         [class.shadow-lg]="cardStyle() === 'elevated'"
                         [class.border]="cardStyle() === 'outlined'"
                         [style.border-color]="cardStyle() === 'outlined' ? 'color-mix(in srgb, var(--wp-text) 15%, var(--wp-bg))' : null">
                  @if (post.featuredImage) {
                    <a [href]="post.url" class="block aspect-[16/10] overflow-hidden" tabindex="-1" aria-hidden="true">
                      <wp-image [media]="post.featuredImage" [eager]="i === 0"
                                [sizes]="'(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'"
                                imgClass="w-full h-full object-cover" />
                    </a>
                  }
                  <div class="p-6">
                    <h2 class="text-xl font-bold leading-snug mb-2">
                      <a [href]="post.url" class="hover:underline underline-offset-4">{{ post.title }}</a>
                    </h2>
                    <p class="text-sm opacity-70">{{ post.publishedAt | date: 'MMM d, y' }} · {{ post.author.displayName }}</p>
                  </div>
                </article>
              } @empty {
                <p class="col-span-full text-center opacity-70 py-16">Nothing here yet.</p>
              }
            </div>
            <wp-pagination
              [page]="d.posts.page"
              [total]="d.posts.total"
              [perPage]="d.posts.perPage"
              [basePath]="(d.taxonomy === 'CATEGORY' ? '/category/' : '/tag/') + d.term.slug + '/'"
            />
          }
          @case ('author') {
            <header class="mb-10 text-center max-w-3xl mx-auto">
              @if (d.author.avatar) {
                <wp-image [media]="d.author.avatar" class="w-24 mx-auto mb-4"
                          imgClass="rounded-full" sizes="96px" />
              }
              <h1 class="text-4xl font-extrabold">{{ d.author.displayName }}</h1>
              @if (d.author.bio) {
                <p class="mt-3 opacity-70">{{ d.author.bio }}</p>
              }
            </header>
            <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              @for (post of d.posts.items; track post.id; let i = $index) {
                <article class="rounded-2xl overflow-hidden border"
                         style="border-color: color-mix(in srgb, var(--wp-text) 15%, var(--wp-bg))">
                  @if (post.featuredImage) {
                    <a [href]="post.url" class="block aspect-[16/10] overflow-hidden" tabindex="-1" aria-hidden="true">
                      <wp-image [media]="post.featuredImage" [eager]="i === 0"
                                [sizes]="'(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'"
                                imgClass="w-full h-full object-cover" />
                    </a>
                  }
                  <div class="p-6">
                    <h2 class="text-xl font-bold leading-snug mb-2">
                      <a [href]="post.url" class="hover:underline underline-offset-4">{{ post.title }}</a>
                    </h2>
                    <p class="text-sm opacity-70">{{ post.publishedAt | date: 'MMM d, y' }}</p>
                  </div>
                </article>
              } @empty {
                <p class="col-span-full text-center opacity-70 py-16">No posts by this author yet.</p>
              }
            </div>
            <wp-pagination
              [page]="d.posts.page"
              [total]="d.posts.total"
              [perPage]="d.posts.perPage"
              [basePath]="'/author/' + d.author.slug + '/'"
            />
          }
          @case ('search') {
            <header class="mb-10 text-center max-w-3xl mx-auto">
              <h1 class="text-3xl font-extrabold">
                @if (d.q) {
                  Results for <span style="color: var(--wp-accent)">“{{ d.q }}”</span>
                } @else {
                  Search
                }
              </h1>
              <p class="mt-2 text-sm opacity-60">{{ d.posts.total }} result{{ d.posts.total === 1 ? '' : 's' }}</p>
              <div class="mt-6 max-w-md mx-auto">
                <wp-search-form [placeholder]="d.q || 'Search…'" />
              </div>
            </header>
            <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              @for (post of d.posts.items; track post.id; let i = $index) {
                <article class="rounded-2xl overflow-hidden border"
                         style="border-color: color-mix(in srgb, var(--wp-text) 15%, var(--wp-bg))">
                  @if (post.featuredImage) {
                    <a [href]="post.url" class="block aspect-[16/10] overflow-hidden" tabindex="-1" aria-hidden="true">
                      <wp-image [media]="post.featuredImage" [eager]="i === 0"
                                [sizes]="'(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'"
                                imgClass="w-full h-full object-cover" />
                    </a>
                  }
                  <div class="p-6">
                    <h2 class="text-xl font-bold leading-snug mb-2">
                      <a [href]="post.url" class="hover:underline underline-offset-4">{{ post.title }}</a>
                    </h2>
                    <p class="text-sm opacity-70">{{ post.publishedAt | date: 'MMM d, y' }}</p>
                  </div>
                </article>
              } @empty {
                @if (d.q) {
                  <p class="col-span-full text-center opacity-70 py-16">Nothing matched your search.</p>
                }
              }
            </div>
            <wp-pagination
              [page]="d.posts.page"
              [total]="d.posts.total"
              [perPage]="d.posts.perPage"
              basePath="/search"
              [query]="'q=' + d.q"
            />
          }
          @case ('notfound') {
            <div class="text-center py-24 max-w-xl mx-auto">
              <p class="text-8xl font-extrabold opacity-20">404</p>
              <h1 class="text-3xl font-extrabold mt-4">Page not found</h1>
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
      <footer class="mt-12 text-white py-12 px-4" style="background: var(--wp-primary)">
        <div class="mx-auto max-w-6xl grid gap-8 md:grid-cols-3">
          <div>
            <p class="text-xl font-extrabold">{{ siteTitle() }}</p>
            @if (showTagline() && tagline()) {
              <p class="mt-2 text-white/70 text-sm">{{ tagline() }}</p>
            }
          </div>
          @if (footerMenu(); as menu) {
            <nav aria-label="Footer" class="md:justify-self-center">
              <wp-nav-menu [items]="menu.items" listClass="space-y-2 text-white/90" />
            </nav>
          }
          <div class="md:justify-self-end text-white/70 text-sm">
            {{ footerText() }}<br />© {{ year() }} {{ siteTitle() }}
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class ModernTheme extends ThemeBase {
  readonly heroTitle = this.textSetting('heroTitle', 'Stories worth reading.');
  readonly heroSubtitle = this.textSetting('heroSubtitle', 'Fresh articles, delivered clean and fast.');
  readonly heroEnabled = this.boolSetting('heroEnabled', true);
  readonly cardStyle = this.textSetting('cardStyle', 'elevated');

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
