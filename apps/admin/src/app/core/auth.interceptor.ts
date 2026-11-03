import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth';

const RETRY_HEADER = 'X-WP-Auth-Retry';

/**
 * Attaches the Bearer token + credentials to every request, and renews an
 * expired access token once (single-flight) before replaying the request.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const withAuth = (token: string | null) =>
    req.clone({
      withCredentials: true,
      setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    });

  return next(withAuth(auth.accessToken)).pipe(
    catchError((err: unknown) => {
      const isAuthCall = req.url.includes('/auth/');
      const alreadyRetried = req.headers.has(RETRY_HEADER);
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || isAuthCall || alreadyRetried) {
        return throwError(() => err);
      }
      return from(auth.refreshOnce()).pipe(
        switchMap((ok) => {
          if (!ok) {
            auth.clear();
            return throwError(() => err);
          }
          return next(withAuth(auth.accessToken).clone({ setHeaders: { [RETRY_HEADER]: '1' } }));
        }),
        catchError((retryErr) => {
          if (retryErr !== err) auth.clear();
          return throwError(() => retryErr);
        }),
      );
    }),
  );
};
