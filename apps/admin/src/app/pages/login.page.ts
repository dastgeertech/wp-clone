import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth';

/** wp-login.php clone. */
@Component({
  selector: 'wp-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen grid place-items-center px-4">
      <div class="w-full max-w-[340px]">
        <div class="mb-6 grid place-items-center">
          <span class="grid size-16 place-items-center rounded-full bg-wp-ink text-white text-3xl font-bold">W</span>
          <h1 class="mt-3 text-2xl font-light text-wp-ink">WP Clone</h1>
        </div>

        <form class="wp-box p-6" (ngSubmit)="submit()" #f="ngForm">
          @if (error()) {
            <div class="wp-notice wp-notice-error mb-4" role="alert">{{ error() }}</div>
          }

          <label class="wp-label" for="identifier">Username or Email Address</label>
          <input
            id="identifier"
            name="identifier"
            class="wp-input"
            autocomplete="username"
            [(ngModel)]="identifier"
            required
          />

          <label class="wp-label mt-3" for="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            class="wp-input"
            autocomplete="current-password"
            [(ngModel)]="password"
            required
          />

          <label class="mt-3 flex items-center gap-2 text-wp">
            <input type="checkbox" name="remember" [(ngModel)]="remember" class="accent-wp-blue" />
            Remember Me
          </label>

          <button class="wp-btn wp-btn-primary mt-4 w-full py-1.5" [disabled]="busy() || f.invalid">
            {{ busy() ? 'Logging in…' : 'Log In' }}
          </button>
        </form>

        <p class="mt-4 text-center text-wp text-wp-muted">
          <a routerLink="/" class="text-wp-blue">← Back to the site</a>
        </p>
        <p class="mt-2 text-center text-wp-sm text-wp-muted">
          Demo credentials: <code class="bg-wp-gray-2 px-1 rounded">admin / admin12345</code>
        </p>
      </div>
    </div>
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);

  identifier = '';
  password = '';
  remember = true;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.identifier.trim(), this.password);
      await this.router.navigateByUrl('/', { replaceUrl: true });
    } catch (err) {
      const body = (err as { error?: { message?: string | string[] } }).error;
      const msg = Array.isArray(body?.message)
        ? body.message.join(', ')
        : (body?.message ?? 'Invalid username or password.');
      this.error.set(String(msg));
    } finally {
      this.busy.set(false);
    }
  }
}
