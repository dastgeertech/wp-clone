import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import type { PostSummary } from '@wp-clone/shared-types';
import { ResponsiveImageComponent } from './responsive-image';

/** Article preview used across every theme's lists. */
@Component({
  selector: 'wp-post-card',
  imports: [RouterModule, DatePipe, ResponsiveImageComponent],
  template: `
    <article>
      @if (showImage() && post().featuredImage) {
        <a [href]="post().url" class="block mb-4 overflow-hidden" tabindex="-1" aria-hidden="true">
          <wp-image [media]="post().featuredImage" [sizes]="imageSizes()" [eager]="eager()"
                    imgClass="transition-transform duration-500 hover:scale-105" />
        </a>
      }
      @if (showCategories() && post().categories.length) {
        <p class="flex flex-wrap items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wide">
          @for (c of post().categories.slice(0, 3); track c.id) {
            <a [href]="'/category/' + c.slug + '/'"
               class="inline-flex min-h-6 items-center hover:underline"
               [style.color]="'var(--wp-accent)'">{{ c.name }}</a>
          }
        </p>
      }
      <h2 class="text-2xl leading-snug font-bold mb-2" [class.text-3xl]="featured()">
        <a [href]="post().url" class="hover:underline underline-offset-4 decoration-2"
           [style.color]="'var(--wp-text)'">{{ post().title }}</a>
      </h2>
      <p class="text-sm opacity-70 mb-3">
        <time [attr.datetime]="post().publishedAt ?? undefined">{{ post().publishedAt | date: 'MMMM d, y' }}</time>
        · <a [href]="'/author/' + post().author.slug + '/'" class="hover:underline">{{ post().author.displayName }}</a>
        @if (post().commentCount) {
          · <a [href]="post().url + '#comments'" class="hover:underline">{{ post().commentCount }} comment{{ post().commentCount === 1 ? '' : 's' }}</a>
        }
      </p>
      @if (post().excerpt) {
        <p class="opacity-80 leading-relaxed">{{ post().excerpt }}</p>
      }
      @if (readMore()) {
        <a [href]="post().url" class="inline-block mt-3 font-semibold hover:underline"
           [style.color]="'var(--wp-accent)'">Continue reading →</a>
      }
    </article>
  `,
})
export class PostCardComponent {
  post = input.required<PostSummary>();
  showImage = input(true);
  showCategories = input(true);
  readMore = input(true);
  featured = input(false);
  eager = input(false);
  imageSizes = input('(min-width: 1024px) 33vw, 100vw');
}
