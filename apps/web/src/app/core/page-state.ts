import type {
  AuthorSummary,
  CommentDto,
  Paged,
  PostDetail,
  PostSummary,
  SiteBootstrap,
  TermSummary,
} from '@wp-clone/shared-types';
import { Injectable, signal, type Type } from '@angular/core';

/** Resolved data for the current route — consumed by every theme. */
export type RouteData =
  | { kind: 'home'; posts: Paged<PostSummary>; staticPage?: PostDetail }
  | { kind: 'post'; post: PostDetail; comments: CommentDto[] }
  | { kind: 'page'; page: PostDetail }
  | {
      kind: 'archive';
      taxonomy: 'CATEGORY' | 'TAG';
      term: TermSummary;
      posts: Paged<PostSummary>;
    }
  | { kind: 'author'; author: AuthorSummary; posts: Paged<PostSummary> }
  | { kind: 'search'; q: string; posts: Paged<PostSummary> }
  | { kind: 'notfound'; path: string };

/**
 * Signals written by the route resolver before the view renders, so themes
 * (any of which may be swapped in at runtime) read the same state.
 */
@Injectable({ providedIn: 'root' })
export class PageState {
  readonly data = signal<RouteData | null>(null);
  readonly site = signal<SiteBootstrap | null>(null);
  readonly themeComponent = signal<Type<unknown> | null>(null);
}
