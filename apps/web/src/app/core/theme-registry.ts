import { Injectable, type Type } from '@angular/core';

export type ThemeId = 'classic' | 'modern' | 'minimal';
export type ThemeRoot = Type<unknown>;

/**
 * Built-in themes. Each id maps to a lazy chunk — only the ACTIVE theme is
 * downloaded by the browser (and it is code-split out of the SSR bundle too).
 * Third-party themes register here the same way.
 */
const REGISTRY: Record<ThemeId, () => Promise<{ default: ThemeRoot }>> = {
  classic: () =>
    import('../themes/classic/classic-theme').then((m) => ({ default: m.ClassicTheme })),
  modern: () =>
    import('../themes/modern/modern-theme').then((m) => ({ default: m.ModernTheme })),
  minimal: () =>
    import('../themes/minimal/minimal-theme').then((m) => ({ default: m.MinimalTheme })),
};

const cache = new Map<string, Promise<ThemeRoot>>();

export function loadThemeComponent(id: string): Promise<ThemeRoot> {
  const factory = REGISTRY[id as ThemeId] ?? REGISTRY.classic;
  let p = cache.get(id);
  if (!p) {
    p = factory().then((m) => m.default);
    cache.set(id, p);
  }
  return p;
}
