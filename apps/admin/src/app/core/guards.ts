import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Capability } from '@wp-clone/shared-types';
import { AuthService } from './auth';

// NOTE: guards may `await`, but `inject()` must run BEFORE the first await —
// the injection context does not survive async boundaries.

/** Requires a session; restores it from the refresh cookie on first visit. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.init();
  return auth.user() ? true : router.createUrlTree(['/login']);
};

/** Login page only — bounce already-authenticated users to the dashboard. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.init();
  return auth.user() ? router.createUrlTree(['/']) : true;
};

/** Requires the session to hold the given capability. */
export function capGuard(cap: Capability): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.init();
    if (!auth.user()) return router.createUrlTree(['/login']);
    return auth.can(cap) ? true : router.createUrlTree(['/']);
  };
}
