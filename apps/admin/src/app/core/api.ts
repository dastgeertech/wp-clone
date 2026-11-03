import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type Query = Record<string, string | number | boolean | null | undefined>;

/** Thin typed wrapper around the REST API (absolute URLs, query serialization). */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** API origin without the `/api` suffix — static files (uploads) live here. */
  origin(): string {
    return this.base.replace(/\/api\/?$/, '');
  }

  /** Resolve site-relative API URLs (`/uploads/...`) for display in the admin. */
  abs(url: string | null | undefined): string {
    if (!url) return '';
    if (/^[a-z]+:\/\//i.test(url)) return url;
    return this.origin() + (url.startsWith('/') ? '' : '/') + url;
  }

  /**
   * Best thumbnail URL for a media item: the smallest responsive WebP that is
   * at least `target` px wide, falling back to the original file.
   */
  thumb(
    media: { url: string; variants?: { webp?: Record<string, string> } | null },
    target = 320,
  ): string {
    const webp = media.variants?.webp;
    if (webp) {
      const widths = Object.keys(webp)
        .map(Number)
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      const pick = widths.find((w) => w >= target) ?? widths[widths.length - 1];
      if (pick !== undefined) return this.abs(webp[String(pick)]);
    }
    return this.abs(media.url);
  }

  get<T>(path: string, query?: Query): Observable<T> {
    return this.http.get<T>(this.base + path, { params: qs(query) });
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<T>(this.base + path, body ?? {});
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http.put<T>(this.base + path, body ?? {});
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http.patch<T>(this.base + path, body ?? {});
  }

  delete<T = void>(path: string): Observable<T> {
    return this.http.delete<T>(this.base + path);
  }

  /** Multipart upload (field name `file`, matches the API). */
  upload<T>(path: string, file: File): Observable<T> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<T>(this.base + path, form);
  }
}

function qs(query?: Query): HttpParams {
  let params = new HttpParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined || value === '') continue;
      params = params.set(key, String(value));
    }
  }
  return params;
}
