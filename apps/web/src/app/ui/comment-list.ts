import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import type { CommentDto } from '@wp-clone/shared-types';

interface FlatComment {
  comment: CommentDto;
  depth: number;
}

/** Threaded comment list (WordPress-style indentation). */
@Component({
  selector: 'wp-comment-list',
  imports: [RouterModule, DatePipe],
  template: `
    @if (thread().length) {
      <ol class="space-y-6">
        @for (row of thread(); track row.comment.id) {
          <li [attr.data-depth]="row.depth" [style.margin-left.px]="row.depth * 24"
              class="border-l-2 pl-4" [style.border-color]="row.depth ? 'color-mix(in srgb, var(--wp-text) 12%, var(--wp-bg))' : 'var(--wp-accent)'">
            <header class="flex items-baseline gap-2 flex-wrap mb-1">
              @if (row.comment.author?.slug) {
                <a [href]="'/author/' + row.comment.author!.slug" class="font-semibold hover:underline">
                  {{ row.comment.authorName }}
                </a>
              } @else {
                <span class="font-semibold">{{ row.comment.authorName }}</span>
              }
              @if (row.comment.authorUrl) {
                <a [href]="row.comment.authorUrl" rel="nofollow noopener external" class="text-sm opacity-60 hover:underline">
                  {{ shortUrl(row.comment.authorUrl) }}
                </a>
              }
              <time class="text-sm opacity-60" [attr.datetime]="row.comment.createdAt">
                {{ row.comment.createdAt | date: 'MMM d, y, h:mm a' }}
              </time>
            </header>
            <div class="opacity-90 wp-comment-body">{{ row.comment.content }}</div>
          </li>
        }
      </ol>
    }
  `,
  styles: `
    .wp-comment-body { white-space: pre-line; overflow-wrap: anywhere; }
  `,
})
export class CommentListComponent {
  comments = input.required<CommentDto[]>();

  /** Depth is derived from the nesting of `replies` arrays. */
  thread = computed<FlatComment[]>(() => {
    const out: FlatComment[] = [];
    const walk = (list: CommentDto[], depth: number) => {
      for (const c of list) {
        out.push({ comment: c, depth });
        if (c.replies?.length) walk(c.replies, depth + 1);
      }
    };
    walk(this.comments(), 0);
    return out;
  });

  shortUrl(url: string): string {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}
