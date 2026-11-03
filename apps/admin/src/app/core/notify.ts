import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** wp-admin-flavored toasts (success + API error surfacing). */
@Injectable({ providedIn: 'root' })
export class Notify {
  private sb = inject(MatSnackBar);

  ok(message: string): void {
    this.sb.open(message, undefined, {
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['wp-snack'],
    });
  }

  error(err: unknown, fallback = 'Something went wrong'): void {
    this.sb.open(message(err, fallback), undefined, {
      duration: 6000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['wp-snack', 'wp-snack-error'],
    });
  }
}

function message(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Cannot reach the API — is `nx serve api` running?';
    const body = err.error as { message?: string | string[] } | string | null;
    if (typeof body === 'string' && body.trim()) return body.slice(0, 240);
    if (body && typeof body === 'object' && body.message) {
      return Array.isArray(body.message)
        ? body.message.join(', ').slice(0, 240)
        : String(body.message).slice(0, 240);
    }
    return `${fallback} (HTTP ${err.status})`;
  }
  if (err instanceof Error && err.message) return err.message.slice(0, 240);
  return fallback;
}
