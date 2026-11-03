import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { AdminComment, AdminPostSummary, Paged, TermSummary } from '@wp-clone/shared-types';
import { Api } from '../core/api';
import { AuthService } from '../core/auth';
import { environment } from '../../environments/environment';
import { formatDate, humanize } from '../shared/format';

interface Glance {
  posts: number | null;
  pages: number | null;
  comments: number | null;
  pending: number | null;
  categories: number;
}

@Component({
  selector: 'wp-dashboard',
  imports: [RouterLink],
  template: `
    <h1 class="mb-4">Dashboard</h1>

    @if (auth.can('manage_options')) {
      <div class="wp-box mb-5 p-5">
        <h2 class="mb-1 font-normal text-wp-lg">Welcome to WP Clone</h2>
        <p class="text-wp text-wp-muted mb-3">
          Everything you need to run your site: posts, pages, media, comments, themes and settings.
        </p>
        <div class="flex flex-wrap gap-2">
          <a routerLink="/posts/new" class="wp-btn">Write a Post</a>
          <a routerLink="/appearance/themes" class="wp-btn">Change Themes</a>
          <a [href]="env.siteUrl" target="_blank" rel="noopener" class="wp-btn">Visit the Site</a>
        </div>
      </div>
    }

    <div class="grid gap-5 lg:grid-cols-2">
      <!-- At a Glance -->
      <section class="wp-box p-4">
        <h2 class="mb-3 text-wp-lg font-normal">At a Glance</h2>
        <ul class="grid grid-cols-2 gap-2 text-wp">
          @if (glance(); as g) {
            <li class="flex items-baseline gap-1.5">
              <span class="text-xl text-wp-blue">{{ g.posts ?? '—' }}</span>
              <a routerLink="/posts" class="text-wp-ink">Posts</a>
            </li>
            <li class="flex items-baseline gap-1.5">
              <span class="text-xl text-wp-blue">{{ g.pages ?? '—' }}</span>
              <a routerLink="/pages" class="text-wp-ink">Pages</a>
            </li>
            <li class="flex items-baseline gap-1.5">
              <span class="text-xl text-wp-blue">{{ g.categories }}</span>
              <span class="text-wp-ink">Categories</span>
            </li>
            @if (g.comments !== null) {
              <li class="flex items-baseline gap-1.5">
                <span class="text-xl text-wp-blue">{{ g.comments }}</span>
                <a routerLink="/comments" class="text-wp-ink">Comments</a>
              </li>
            }
            @if (g.pending) {
              <li class="col-span-2 text-wp text-wp-yellow">
                {{ g.pending }} comment{{ g.pending === 1 ? '' : 's' }} awaiting moderation.
                <a routerLink="/comments" [queryParams]="{ status: 'PENDING' }">Review</a>
              </li>
            }
          } @else {
            <li class="text-wp-muted">Loading stats…</li>
          }
        </ul>
      </section>

      <!-- Recent Comments -->
      @if (auth.can('moderate_comments')) {
        <section class="wp-box p-4">
          <h2 class="mb-3 text-wp-lg font-normal">Recent Comments</h2>
          @if (comments(); as list) {
            @if (list.length === 0) {
              <p class="text-wp text-wp-muted">No comments yet.</p>
            } @else {
              <ul class="text-wp divide-y divide-wp-gray-2">
                @for (c of list; track c.id) {
                  <li class="py-2 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <span class="font-semibold">{{ c.authorName }}</span>
                      <span class="text-wp-muted"> on </span>
                      <a [routerLink]="['/posts', c.postId]" class="truncate">
                        {{ c.post?.title ?? '(unknown post)' }}
                      </a>
                      <p class="text-wp-muted truncate">{{ c.content }}</p>
                    </div>
                    <span class="wp-pill" [class.wp-pill-trash]="c.status === 'TRASH'"
                          [class.wp-pill-pending]="c.status === 'PENDING'"
                          [class.wp-pill-published]="c.status === 'APPROVED'">
                      {{ statusLabel(c.status) }}
                    </span>
                  </li>
                }
              </ul>
              <a routerLink="/comments" class="mt-2 inline-block text-wp">All Comments →</a>
            }
          } @else {
            <p class="text-wp-muted">Loading…</p>
          }
        </section>
      }

      <!-- Recent Posts -->
      @if (auth.can('edit_posts')) {
        <section class="wp-box p-4 lg:col-span-2">
          <h2 class="mb-3 text-wp-lg font-normal">Recent Posts</h2>
          @if (posts(); as list) {
            @if (list.length === 0) {
              <p class="text-wp text-wp-muted">No posts yet. <a routerLink="/posts/new">Write your first post</a>.</p>
            } @else {
              <table class="wp-table">
                <thead>
                  <tr><th>Title</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  @for (p of list; track p.id) {
                    <tr>
                      <td>
                        <a [routerLink]="['/posts', p.id]" class="font-semibold text-wp-ink">{{ p.title }}</a>
                      </td>
                      <td>
                        <span class="wp-pill" [class]="'wp-pill-' + p.status.toLowerCase()">
                          {{ humanize(p.status) }}
                        </span>
                      </td>
                      <td class="text-wp-muted whitespace-nowrap">{{ formatDate(p.publishedAt ?? p.updatedAt) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              <a routerLink="/posts" class="mt-2 inline-block text-wp">All Posts →</a>
            }
          } @else {
            <p class="text-wp-muted">Loading…</p>
          }
        </section>
      }
    </div>
  `,
})
export class DashboardPage {
  readonly auth = inject(AuthService);
  private api = inject(Api);
  readonly env = environment;

  readonly glance = signal<Glance | null>(null);
  readonly posts = signal<AdminPostSummary[] | null>(null);
  readonly comments = signal<AdminComment[] | null>(null);

  readonly humanize = humanize;
  readonly formatDate = formatDate;
  readonly statusLabel = (s: string) => humanize(s);

  constructor() {
    const canPosts = this.auth.can('edit_posts');
    const canComments = this.auth.can('moderate_comments');

    forkJoin({
      posts: canPosts
        ? this.api.get<Paged<AdminPostSummary>>('/posts', { type: 'POST', perPage: 1 })
        : of(null),
      pages: canPosts
        ? this.api.get<Paged<AdminPostSummary>>('/posts', { type: 'PAGE', perPage: 1 })
        : of(null),
      comments: canComments
        ? this.api.get<Paged<AdminComment>>('/comments', { perPage: 1 })
        : of(null),
      pending: canComments
        ? this.api.get<Paged<AdminComment>>('/comments', { status: 'PENDING', perPage: 1 })
        : of(null),
      categories: this.api.get<TermSummary[]>('/terms', { taxonomy: 'CATEGORY' }),
      recentPosts: canPosts
        ? this.api.get<Paged<AdminPostSummary>>('/posts', { perPage: 5 })
        : of(null),
      recentComments: canComments
        ? this.api.get<Paged<AdminComment>>('/comments', { perPage: 5 })
        : of(null),
    }).subscribe((r) => {
      this.glance.set({
        posts: r.posts?.total ?? null,
        pages: r.pages?.total ?? null,
        comments: r.comments?.total ?? null,
        pending: r.pending?.total ?? null,
        categories: r.categories.length,
      });
      this.posts.set(r.recentPosts?.items ?? null);
      this.comments.set(r.recentComments?.items ?? null);
    });
  }
}
