import type { ThemeManifest, ThemeSettingControl } from '@wp-clone/shared-types';

/** Controls shown in Appearance → Customize, per theme. */
const COMMON: ThemeSettingControl[] = [
  { key: 'siteLogo', label: 'Site logo', type: 'image', default: '', section: 'header' },
  { key: 'showTagline', label: 'Show tagline under site title', type: 'checkbox', default: true, section: 'header' },
  { key: 'primaryColor', label: 'Primary color', type: 'color', default: '#1d2327', section: 'colors' },
  { key: 'accentColor', label: 'Accent color', type: 'color', default: '#2271b1', section: 'colors' },
  { key: 'backgroundColor', label: 'Background color', type: 'color', default: '#ffffff', section: 'colors' },
  { key: 'textColor', label: 'Text color', type: 'color', default: '#1d2327', section: 'colors' },
  {
    key: 'fontFamily', label: 'Base font', type: 'select', section: 'typography',
    default: 'system',
    options: [
      { value: 'system', label: 'System UI' },
      { value: 'serif', label: 'Serif (Georgia)' },
      { value: 'mono', label: 'Monospace' },
      { value: 'rounded', label: 'Rounded (Trebuchet)' },
    ],
  },
  { key: 'contentWidth', label: 'Content width (px)', type: 'number', default: 720, section: 'layout' },
  { key: 'footerText', label: 'Footer text', type: 'textarea', default: 'Proudly powered by WP Clone', section: 'footer' },
];

const withExtra = (extra: ThemeSettingControl[]): ThemeSettingControl[] => [
  ...COMMON,
  ...extra,
];

/**
 * Built-in themes. The Angular component for each id lives in
 * `apps/web/src/app/themes/<id>`; the manifest is stored in the DB so
 * third-party themes could be added the same way.
 */
export const BUILTIN_THEMES: ThemeManifest[] = [
  {
    id: 'classic',
    name: 'WP Clone Classic',
    version: '1.0.0',
    author: 'WP Clone',
    description: 'A timeless single-column blog with a cozy reading column, perfect for writing.',
    screenshot: '/themes/classic.svg',
    settingsSchema: withExtra([
      { key: 'showAuthorMeta', label: 'Show author bio under posts', type: 'checkbox', default: true, section: 'posts' },
      { key: 'showFeaturedImage', label: 'Show featured image on single posts', type: 'checkbox', default: true, section: 'posts' },
    ]),
  },
  {
    id: 'modern',
    name: 'WP Clone Modern',
    version: '1.0.0',
    author: 'WP Clone',
    description: 'A bold, full-width theme with a hero area and a responsive card grid.',
    screenshot: '/themes/modern.svg',
    settingsSchema: withExtra([
      { key: 'heroTitle', label: 'Hero heading', type: 'text', default: 'Stories worth reading.', section: 'hero' },
      { key: 'heroSubtitle', label: 'Hero subtitle', type: 'text', default: 'Fresh articles, delivered clean and fast.', section: 'hero' },
      { key: 'heroEnabled', label: 'Show hero on homepage', type: 'checkbox', default: true, section: 'hero' },
      { key: 'cardStyle', label: 'Card style', type: 'select', default: 'elevated', section: 'posts',
        options: [
          { value: 'elevated', label: 'Elevated' },
          { value: 'flat', label: 'Flat' },
          { value: 'outlined', label: 'Outlined' },
        ] },
    ]),
  },
  {
    id: 'minimal',
    name: 'WP Clone Minimal',
    version: '1.0.0',
    author: 'WP Clone',
    description: 'A magazine layout with a sticky sidebar, category columns and crisp typography.',
    screenshot: '/themes/minimal.svg',
    settingsSchema: withExtra([
      { key: 'showSidebar', label: 'Show sidebar on archives', type: 'checkbox', default: true, section: 'layout' },
      {
        key: 'sidebarPosition', label: 'Sidebar position', type: 'select', default: 'right', section: 'layout',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ],
      },
      { key: 'showCategoryColors', label: 'Color-code category labels', type: 'checkbox', default: true, section: 'posts' },
    ]),
  },
];

export const THEME_IDS = BUILTIN_THEMES.map((t) => t.id);

export function defaultsFor(manifest: ThemeManifest): Record<string, unknown> {
  return Object.fromEntries(manifest.settingsSchema.map((c) => [c.key, c.default]));
}
