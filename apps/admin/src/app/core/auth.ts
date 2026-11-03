import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthUser, Capability, LoginResponse, roleCan } from '@wp-clone/shared-types';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'wp_clone_admin_token';

/**
 * Session state for the admin SPA.
 *
 * Bootstrap tries the httpOnly refresh cookie (`POST /auth/refresh`); the
 * access token is kept in memory + localStorage so reloads skip one round
 * trip. The auth interceptor renews an expired token transparently.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly user = signal<AuthUser | null>(null);
  /** True once the initial session restore has finished. */
  readonly ready = signal(false);

  private token: string | null = null;
  private initialized = false;
  private refreshInFlight: Promise<boolean> | null = null;

  get accessToken(): string | null {
    return this.token;
  }

  can(cap: Capability): boolean {
    const user = this.user();
    if (!user) return false;
    return user.capabilities.includes(cap) || roleCan(user.role, cap);
  }

  /** Idempotent session restore — awaited by route guards. */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) this.token = stored;
    try {
      if (this.token) {
        const user = await firstValueFrom(
          this.http.get<AuthUser>(`${environment.apiUrl}/auth/me`),
        );
        this.user.set(user);
      } else if (!(await this.refreshOnce())) {
        this.clear();
      }
    } catch {
      this.clear();
    } finally {
      this.ready.set(true);
    }
  }

  async login(identifier: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(
        `${environment.apiUrl}/auth/login`,
        { identifier, password },
        { withCredentials: true },
      ),
    );
    this.setSession(res);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/auth/logout`, null, {
          withCredentials: true,
          responseType: 'text',
        }),
      );
    } catch {
      /* cookie may already be gone — clear locally regardless */
    }
    this.clear();
    this.router.navigate(['/login']);
  }

  /**
   * Single-flight refresh: concurrent callers (interceptor + init) share one
   * request. Resolves `false` when the refresh cookie is missing/expired.
   */
  refreshOnce(): Promise<boolean> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = firstValueFrom(
        this.http.post<LoginResponse>(
          `${environment.apiUrl}/auth/refresh`,
          null,
          { withCredentials: true },
        ),
      )
        .then((res) => {
          this.setSession(res);
          return true;
        })
        .catch(() => false)
        .finally(() => {
          this.refreshInFlight = null;
        });
    }
    return this.refreshInFlight;
  }

  clear(): void {
    this.token = null;
    this.user.set(null);
    localStorage.removeItem(TOKEN_KEY);
  }

  private setSession(res: LoginResponse): void {
    this.token = res.accessToken;
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    this.user.set(res.user);
  }
}
