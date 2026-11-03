import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { SiteBootstrap } from '@wp-clone/shared-types';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Site-wide bootstrap data (options + active theme + menus + categories).
 * Fetched once per server render, replayed to the client by the HTTP
 * transfer cache, then reused for every client-side navigation.
 */
@Injectable({ providedIn: 'root' })
export class SiteService {
  private http = inject(HttpClient);
  private pending?: Promise<SiteBootstrap>;

  bootstrap = signal<SiteBootstrap | null>(null);

  options = computed(() => this.bootstrap()?.options ?? null);
  theme = computed(() => this.bootstrap()?.theme ?? null);
  /** Customizer settings of the active theme. */
  settings = computed<Record<string, unknown>>(
    () => this.bootstrap()?.theme.settings ?? {},
  );
  menus = computed(() => this.bootstrap()?.menus ?? []);
  categories = computed(() => this.bootstrap()?.categories ?? []);

  /** Primary nav (falls back to the first menu). */
  primaryMenu = computed(() => {
    const menus = this.menus();
    return menus.find((m) => m.location === 'primary') ?? menus[0] ?? null;
  });
  footerMenu = computed(
    () => this.menus().find((m) => m.location === 'footer') ?? null,
  );

  load(): Promise<SiteBootstrap> {
    if (!this.pending) {
      this.pending = firstValueFrom(
        this.http.get<SiteBootstrap>(`${environment.apiUrl}/content/bootstrap`),
      )
        .then((b) => {
          this.bootstrap.set(b);
          return b;
        })
        .catch((err) => {
          this.pending = undefined; // allow retry after transient failures
          throw err;
        });
    }
    return this.pending;
  }
}
