import { DatePipe } from '@angular/common';
import { Component, computed } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommentFormComponent } from '../../ui/comment-form';
import { CommentListComponent } from '../../ui/comment-list';
import { NavMenuComponent } from '../../ui/nav-menu';
import { PaginationComponent } from '../../ui/pagination';
import { PostCardComponent } from '../../ui/post-card';
import { ResponsiveImageComponent } from '../../ui/responsive-image';
import { SearchFormComponent } from '../../ui/search-form';
import { ThemeBase } from '../theme-base';

/**
 * WP Clone Classic — a timeless single-column blog: serif type, centered
 * reading column, cozy borders. Everything reads from the customizer.
 */
@Component({
  selector: 'wp-classic-theme',
  imports: [
    DatePipe,
    RouterModule,
    NavMenuComponent,
    SearchFormComponent,
    PostCardComponent,
    PaginationComponent,
    ResponsiveImageComponent,
    CommentListComponent,
    CommentFormComponent,
  ],
  template: `
    <div [style]="cssVars()" class="min-h-screen flex flex-col">
      @let d = data();
      <!-- Header -->
      <header class="border-b" style="border-color: color-mix(in srgb, var(--wp-text) 15%, var(--wp-bg))">
        <div class="mx-auto px-4 py-8 text-center" [style.max-width.px]="contentWidth()">
          @if (logoUrl()) {
            <a href="/" class="inline-block mb-3">
              <img [src]="logoUrl()" [alt]="siteTitle()" class="h-16 mx-auto" />
            </a>
          }
          <a href="/" class="text-4xl font-bold tracking-tight hover:underline underline-offset-4"
             style="font-family: Georgia, 'Times New Roman', serif">
            {{ siteTitle() }}
          </a>
          @if (showTagline() && tagline()) {
            <p class="mt-2 italic opacity-70">{{ tagline() }}</p>
          }
          <nav class="mt-5 flex justify-center" aria-label="Primary">
            @if (primaryMenu(); as menu) {
              <wp-nav-menu [items]="menu.items" listClass="flex flex-wrap justify-center gap-x-1" />
            }
          </nav>
          <div class="mt-5 max-w-md mx-auto">
            <wp-search-form />
          </div>
        </div>
      </header>

      <!-- Main -->
      <main class="flex-1 mx-auto w-full px-4 py-10" [style.max-width.px]="contentWidth()">
        @switch (d.kind) {
          @case ('home') {
            @if (d.staticPage; as page) {
              <article>
                <h1 class="text-3xl font-bold mb-6">{{ page.title }}</h1>
                <div class="wp-prose" [innerHTML]="page.contentHtml"></div>
              </article>
            } @else {
              <div class="space-y-12">
                @for (post of d.posts.items; track post.id; let i = $index) {
                  <wp-post-card [post]="post" [eager]="i === 0" [featured]="i === 0" />
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
            }
          }
          @case ('post') {
            <article>
              <header class="mb-8 text-center">
                @if (d.post.categories.length) {
                  <p class="flex justify-center gap-3 mb-3 text-xs font-semibold uppercase tracking-widest">
                    @for (c of d.post.categories; track c.id) {
                      <a [href]="'/category/' + c.slug + '/'" style="color: var(--wp-accent)" class="hover:underline">
                        {{ c.name }}
                      </a>
                    }
                  </p>
                }
                <h1 class="text-4xl font-bold leading-tight"
                    style="font-family: Georgia, 'Times New Roman', serif">
                  {{ d.post.title }}
                </h1>
                <p class="mt-4 text-sm opacity-70">
                  <time [attr.datetime]="d.post.publishedAt ?? undefined">
                    {{ d.post.publishedAt | date: 'MMMM d, y' }}
                  </time>
                  · <a [href]="'/author/' + d.post.author.slug + '/'" class="hover:underline">
                    {{ d.post.author.displayName }}
                  </a>
                  · {{ d.post.commentCount }} comment{{ d.post.commentCount === 1 ? '' : 's' }}
                </p>
              </header>

              @if (showFeaturedImage() && d.post.featuredImage) {
                <figure class="mb-8">
                  <wp-image [media]="d.post.featuredImage" [eager]="true"
                            [sizes]="'(min-width: 1024px) 720px, 100vw'" />
                  @if (d.post.featuredImage.caption) {
                    <figcaption class="mt-2 text-center text-sm opacity-60">
                      {{ d.post.featuredImage.caption }}
                    </figcaption>
                  }
                </figure>
              }

              <div class="wp-prose" [innerHTML]="d.post.contentHtml"></div>

              @if (d.post.tags.length) {
                <p class="mt-8 flex flex-wrap gap-2">
                  @for (t of d.post.tags; track t.id) {
                    <a [href]="'/tag/' + t.slug + '/'"
                       class="px-3 py-1 text-sm rounded-full border hover:underline"
                       style="border-color: color-mix(in srgb, var(--wp-text) 25%, var(--wp-bg))">
                      #{{ t.name }}
                    </a>
                  }
                </p>
              }

              @if (showAuthorMeta() && d.post.author.bio) {
                <aside class="mt-10 p-6 rounded-lg border flex gap-5 items-start"
                       style="border-color: color-mix(in srgb, var(--wp-text) 15%, var(--wp-bg));
                              background: color-mix(in srgb, var(--wp-text) 4%, var(--wp-bg))">
                  @if (d.post.author.avatar) {
                    <wp-image [media]="d.post.author.avatar" class="w-16 shrink-0"
                              imgClass="rounded-full" sizes="64px" />
                  }
                  <div>
                    <p class="font-bold">{{ d.post.author.displayName }}</p>
                    <p class="text-sm opacity-75 mt-1">{{ d.post.author.bio }}</p>
                  </div>
                </aside>
              }
            </article>

            <!-- Comments -->
            <section id="comments" class="mt-14 pt-8 border-t"
                     style="border-color: color-mix(in srgb, var(--wp-text) 15%, var(--wp-bg))">
              <h2 class="text-2xl font-bold mb-6" style="font-family: Georgia, serif">
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
            <article>
              <h1 class="text-4xl font-bold mb-8 text-center"
                  style="font-family: Georgia, serif">
                {{ d.page.title }}
              </h1>
              <div class="wp-prose" [innerHTML]="d.page.contentHtml"></div>
            </article>
          }
          @case ('archive') {
            <header class="text-center mb-10">
              <p class="text-xs uppercase tracking-widest opacity-60 mb-2">
                {{ d.taxonomy === 'CATEGORY' ? 'Category' : 'Tag' }}
              </p>
              <h1 class="text-4xl font-bold" style="font-family: Georgia, serif">
                {{ d.term.name }}
              </h1>
              @if (d.term.description) {
                <p class="mt-3 italic opacity-70">{{ d.term.description }}</p>
              }
              <p class="mt-2 text-sm opacity-60">{{ d.term.postCount }} post{{ d.term.postCount === 1 ? '' : 's' }}</p>
            </header>
            <div class="space-y-12">
              @for (post of d.posts.items; track post.id; let i = $index) {
                <wp-post-card [post]="post" [eager]="i === 0" />
              } @empty {
                <p class="text-center opacity-70 py-16">No posts in this {{ d.taxonomy === 'CATEGORY' ? 'category' : 'tag' }} yet.</p>
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
            <header class="text-center mb-10">
              @if (d.author.avatar) {
                <wp-image [media]="d.author.avatar" class="w-24 mx-auto mb-4"
                          imgClass="rounded-full" sizes="96px" />
              }
              <h1 class="text-4xl font-bold" style="font-family: Georgia, serif">
                {{ d.author.displayName }}
              </h1>
              @if (d.author.bio) {
                <p class="mt-3 italic opacity-70 max-w-xl mx-auto">{{ d.author.bio }}</p>
              }
            </header>
            <div class="space-y-12">
              @for (post of d.posts.items; track post.id; let i = $index) {
                <wp-post-card [post]="post" [eager]="i === 0" />
              } @empty {
                <p class="text-center opacity-70 py-16">No posts by this author yet.</p>
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
            <header class="text-center mb-10">
              <h1 class="text-3xl font-bold" style="font-family: Georgia, serif">
                @if (d.q) {
                  Search results for: <span style="color: var(--wp-accent)">“{{ d.q }}”</span>
                } @else {
                  Search
                }
              </h1>
              <p class="mt-2 text-sm opacity-60">
                {{ d.posts.total }} result{{ d.posts.total === 1 ? '' : 's' }}
              </p>
              <div class="mt-6 max-w-md mx-auto">
                <wp-search-form [placeholder]="d.q || 'Search…'" />
              </div>
            </header>
            <div class="space-y-12">
              @for (post of d.posts.items; track post.id; let i = $index) {
                <wp-post-card [post]="post" [eager]="i === 0" />
              } @empty {
                @if (d.q) {
                  <p class="text-center opacity-70 py-16">Nothing matched your search. Try different keywords.</p>
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
            <div class="text-center py-20">
              <p class="text-7xl font-bold opacity-20" style="font-family: Georgia, serif">404</p>
              <h1 class="text-3xl font-bold mt-4" style="font-family: Georgia, serif">
                Page not found
              </h1>
              <p class="mt-3 opacity-70">The page you were looking for doesn’t exist or has been moved.</p>
              <div class="mt-8 max-w-md mx-auto">
                <wp-search-form />
              </div>
              <a href="/" class="inline-block mt-6 font-semibold" style="color: var(--wp-accent)">
                ← Back to home
              </a>
            </div>
          }
        }
      </main>

      <!-- Footer -->
      <footer class="border-t py-8 text-center text-sm"
              style="border-color: color-mix(in srgb, var(--wp-text) 15%, var(--wp-bg))">
        @if (footerMenu(); as menu) {
          <nav class="mb-3" aria-label="Footer">
            <wp-nav-menu [items]="menu.items" listClass="flex flex-wrap justify-center gap-x-5 gap-y-1" />
          </nav>
        }
        <p class="opacity-70">
          {{ footerText() }} · © {{ year() }} {{ siteTitle() }}
        </p>
      </footer>
    </div>
  `,
})
export class ClassicTheme extends ThemeBase {
  readonly showFeaturedImage = this.boolSetting('showFeaturedImage', true);
  readonly showAuthorMeta = this.boolSetting('showAuthorMeta', true);

  private boolSetting(key: string, fallback: boolean) {
    return computed(() => {
      const v = this.settings()[key];
      return v === undefined || v === null ? fallback : Boolean(v);
    });
  }
}
