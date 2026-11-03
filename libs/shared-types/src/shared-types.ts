export type RoleName =
  | 'ADMINISTRATOR'
  | 'EDITOR'
  | 'AUTHOR'
  | 'CONTRIBUTOR'
  | 'SUBSCRIBER';

export type Capability =
  | 'read'
  | 'edit_posts'
  | 'edit_others_posts'
  | 'publish_posts'
  | 'delete_posts'
  | 'delete_others_posts'
  | 'edit_pages'
  | 'publish_pages'
  | 'delete_pages'
  | 'upload_files'
  | 'manage_categories'
  | 'moderate_comments'
  | 'list_users'
  | 'edit_users'
  | 'delete_users'
  | 'switch_themes'
  | 'edit_theme_options'
  | 'manage_options';

const SUBSCRIBER: Capability[] = ['read'];
const CONTRIBUTOR: Capability[] = [...SUBSCRIBER, 'edit_posts', 'delete_posts'];
const AUTHOR: Capability[] = [
  ...CONTRIBUTOR,
  'publish_posts',
  'upload_files',
];
const EDITOR: Capability[] = [
  ...AUTHOR,
  'edit_others_posts',
  'delete_others_posts',
  'edit_pages',
  'publish_pages',
  'delete_pages',
  'manage_categories',
  'moderate_comments',
];
const ADMINISTRATOR: Capability[] = [
  ...EDITOR,
  'list_users',
  'edit_users',
  'delete_users',
  'switch_themes',
  'edit_theme_options',
  'manage_options',
];

export const ROLE_CAPABILITIES: Record<RoleName, readonly Capability[]> = {
  SUBSCRIBER,
  CONTRIBUTOR,
  AUTHOR,
  EDITOR,
  ADMINISTRATOR,
};

export function roleCan(role: RoleName, cap: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(cap) ?? false;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: RoleName;
  capabilities: Capability[];
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

/* ------------------------------------------------------------------ */
/* Content types shared by the API, the SSR web app and the admin SPA */
/* ------------------------------------------------------------------ */

export type TaxonomyName = 'CATEGORY' | 'TAG';
export type PostTypeName = 'POST' | 'PAGE';
export type PostStatusName =
  | 'DRAFT'
  | 'PENDING'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'TRASH';
export type CommentStatusName = 'PENDING' | 'APPROVED' | 'SPAM' | 'TRASH';
export type CommentOpenState = 'OPEN' | 'CLOSED';

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

export interface AuthorSummary {
  id: string;
  displayName: string;
  slug: string;
  bio?: string | null;
  avatar?: MediaSummary | null;
}

export interface TermSummary {
  id: string;
  taxonomy: TaxonomyName;
  name: string;
  slug: string;
  description?: string | null;
  postCount: number;
  parentId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface MediaVariants {
  /** Relative URL of the untouched original. */
  original?: string;
  /** width -> relative WebP URL */
  webp?: Record<string, string>;
}

export interface MediaSummary {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  altText?: string | null;
  caption?: string | null;
  variants: MediaVariants;
}

export interface PostSummary {
  id: string;
  type: PostTypeName;
  title: string;
  slug: string;
  /** Site-relative URL, e.g. `/hello-world/` */
  url: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  updatedAt?: string;
  isSticky: boolean;
  commentStatus: CommentOpenState;
  commentCount: number;
  author: AuthorSummary;
  featuredImage?: MediaSummary | null;
  categories: TermSummary[];
  tags: TermSummary[];
}

export interface PostDetail extends PostSummary {
  contentHtml: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  noIndex: boolean;
}

export interface CommentDto {
  id: string;
  parentId?: string | null;
  authorName: string;
  authorUrl?: string | null;
  content: string;
  createdAt: string;
  author?: AuthorSummary | null;
  replies?: CommentDto[];
}

export interface CreateCommentInput {
  postId: string;
  parentId?: string;
  authorName: string;
  authorEmail: string;
  authorUrl?: string;
  content: string;
  /** Honeypot — must stay empty. */
  website?: string;
}

export interface PublicOptions {
  siteTitle: string;
  tagline: string;
  siteUrl: string;
  language: string;
  postsPerPage: number;
  homepageDisplays: 'posts' | 'page';
  homepageId?: string | null;
  defaultCommentStatus: CommentOpenState;
  commentsRequireApproval: boolean;
  seoDefaultTitleTemplate: string;
  seoNoIndexSite: boolean;
}

export type SettingControlType =
  | 'color'
  | 'text'
  | 'textarea'
  | 'select'
  | 'number'
  | 'checkbox'
  | 'image';

export interface ThemeSettingControl {
  key: string;
  label: string;
  type: SettingControlType;
  default: unknown;
  options?: { value: string; label: string }[];
  section?: string;
}

export interface ThemeManifest {
  id: string;
  name: string;
  version: string;
  author?: string | null;
  authorUri?: string | null;
  description?: string | null;
  screenshot?: string | null;
  settingsSchema: ThemeSettingControl[];
}

export interface ThemeState extends ThemeManifest {
  isActive: boolean;
  settings: Record<string, unknown>;
}

export interface MenuItemDto {
  id: string;
  label: string;
  url?: string | null;
  order: number;
  children?: MenuItemDto[];
}

export interface MenuDto {
  id: string;
  name: string;
  location?: string | null;
  items: MenuItemDto[];
}

export interface SiteBootstrap {
  options: PublicOptions;
  theme: ThemeState;
  menus: MenuDto[];
  categories: TermSummary[];
}

export interface ArchiveQuery {
  page?: number;
  perPage?: number;
}

/* --------------------------- admin-facing --------------------------- */

export interface AdminPostSummary {
  id: string;
  type: PostTypeName;
  status: PostStatusName;
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
  createdAt: string;
  isSticky: boolean;
  commentStatus: CommentOpenState;
  menuOrder: number;
  parentId?: string | null;
  template?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  noIndex: boolean;
  author: { id: string; displayName: string; slug: string };
  terms: { term: TermSummary }[];
  featuredImage?: MediaSummary | null;
}

export interface AdminPostDetail extends AdminPostSummary {
  /** TipTap JSON document */
  content: unknown;
  contentHtml: string;
}

export interface AdminComment {
  id: string;
  postId: string;
  parentId?: string | null;
  authorName: string;
  authorEmail: string;
  authorUrl?: string | null;
  content: string;
  status: CommentStatusName;
  createdAt: string;
  post?: { id: string; title: string; slug: string; type: PostTypeName } | null;
  user?: { id: string; displayName: string; slug: string } | null;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  slug: string;
  bio?: string | null;
  role: RoleName;
  isActive: boolean;
  createdAt: string;
}
