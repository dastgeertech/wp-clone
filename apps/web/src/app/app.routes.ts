import { Route } from '@angular/router';
import { ContentResolver } from './core/content.resolver';
import { ThemeOutlet } from './theme-outlet';

/**
 * WordPress permalink structure `/%postname%/`:
 * `/` · `/search` · `/category/:slug` · `/tag/:slug` · `/author/:slug` · `/:slug`.
 * Every route is server rendered (see app.routes.server.ts) and resolved
 * to a discriminated RouteData union before the theme renders.
 */
export const appRoutes: Route[] = [
  { path: '', component: ThemeOutlet, resolve: { wp: ContentResolver } },
  { path: 'search', component: ThemeOutlet, resolve: { wp: ContentResolver } },
  { path: 'category/:slug', component: ThemeOutlet, resolve: { wp: ContentResolver } },
  { path: 'tag/:slug', component: ThemeOutlet, resolve: { wp: ContentResolver } },
  { path: 'author/:slug', component: ThemeOutlet, resolve: { wp: ContentResolver } },
  { path: ':slug', component: ThemeOutlet, resolve: { wp: ContentResolver } },
  { path: '**', component: ThemeOutlet, resolve: { wp: ContentResolver } },
];
