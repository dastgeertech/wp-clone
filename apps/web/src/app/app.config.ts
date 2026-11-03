import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling, UrlSerializer } from '@angular/router';
import { ContentResolver } from './core/content.resolver';
import { WpUrlSerializer } from './core/url-serializer';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      appRoutes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
    ),
    // WordPress permalinks end with "/" — see WpUrlSerializer.
    { provide: UrlSerializer, useClass: WpUrlSerializer },
    // SSR renders every request; responses are replayed on hydration (no double fetch).
    // NOTE: withHttpTransferCache is enabled by default with provideClientHydration
    // (disable via withNoHttpTransferCache()).
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch()),
    ContentResolver,
  ],
};
