import { computed, inject, type Signal } from '@angular/core';
import type { SiteBootstrap } from '@wp-clone/shared-types';
import { PageState, type RouteData } from '../core/page-state';
import { SiteService } from '../core/site.service';

const FONT_STACKS: Record<string, string> = {
  system: `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif`,
  serif: `Georgia, 'Times New Roman', Times, serif`,
  mono: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
  rounded: `'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif`,
};

const DEFAULTS: Record<string, unknown> = {
  siteLogo: '',
  showTagline: true,
  primaryColor: '#1d2327',
  accentColor: '#2271b1',
  backgroundColor: '#ffffff',
  textColor: '#1d2327',
  fontFamily: 'system',
  contentWidth: 720,
  footerText: 'Proudly powered by WP Clone',
};

/**
 * Base class for every theme root component: exposes the resolved route
 * data, the site bootstrap and the customizer settings (as plain values and
 * as CSS custom properties applied on the theme root element).
 */
export abstract class ThemeBase {
  protected readonly page = inject(PageState);
  protected readonly siteService = inject(SiteService);

  /** Resolved data for the current route (never null while rendering). */
  readonly data: Signal<RouteData> = this.page.data as Signal<RouteData>;
  readonly site: Signal<SiteBootstrap> = this.page.site as Signal<SiteBootstrap>;

  readonly options = this.siteService.options;
  readonly settings = this.siteService.settings;
  readonly primaryMenu = this.siteService.primaryMenu;
  readonly footerMenu = this.siteService.footerMenu;
  readonly categories = this.siteService.categories;

  /* ---------------------- customizer helpers ---------------------- */

  private setting<T>(key: string, fallback: T): T {
    const v = this.settings()[key];
    return (v === undefined || v === null || v === '') ? fallback : (v as T);
  }

  readonly siteTitle = computed(() => this.options()?.siteTitle ?? 'WP Clone');
  readonly tagline = computed(() => this.options()?.tagline ?? '');
  readonly siteUrl = computed(() => this.options()?.siteUrl ?? '/');
  readonly postsPerPage = computed(() => this.options()?.postsPerPage ?? 10);

  readonly logoUrl = computed(() => this.setting<string>('siteLogo', ''));
  readonly showTagline = computed(() => this.setting('showTagline', true));
  readonly footerText = computed(() =>
    this.setting('footerText', DEFAULTS['footerText'] as string),
  );

  readonly primaryColor = computed(() =>
    this.setting('primaryColor', DEFAULTS['primaryColor'] as string),
  );
  readonly accentColor = computed(() =>
    this.setting('accentColor', DEFAULTS['accentColor'] as string),
  );
  readonly backgroundColor = computed(() =>
    this.setting('backgroundColor', DEFAULTS['backgroundColor'] as string),
  );
  readonly textColor = computed(() =>
    this.setting('textColor', DEFAULTS['textColor'] as string),
  );
  readonly fontFamily = computed(() =>
    this.setting('fontFamily', DEFAULTS['fontFamily'] as string),
  );
  readonly contentWidth = computed(() =>
    this.setting('contentWidth', DEFAULTS['contentWidth'] as number),
  );

  /** Customizer values as CSS custom properties for the theme root. */
  readonly cssVars = computed<Record<string, string>>(() => ({
    '--wp-primary': this.primaryColor(),
    '--wp-accent': this.accentColor(),
    '--wp-bg': this.backgroundColor(),
    '--wp-text': this.textColor(),
    '--wp-font': FONT_STACKS[this.fontFamily()] ?? FONT_STACKS['system'],
    '--wp-content-width': `${this.contentWidth()}px`,
  }));

  /* ---------------------- view helpers ---------------------- */

  /** Single-column max width from the customizer. */
  readonly columnStyle = computed(() => ({ 'max-width': `${this.contentWidth()}px` }));

  year(): number {
    return new Date().getFullYear();
  }
}
