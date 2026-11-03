import { Route } from '@angular/router';
import { authGuard, capGuard, guestGuard } from './core/guards';

/**
 * wp-admin routes. Every page is lazily code-split; route `data.type`
 * binds to the page input (`withComponentInputBinding`), route param `id`
 * binds to the editor's `id` input.
 */
export const appRoutes: Route[] = [
  {
    path: 'login',
    title: 'Log In — WP Clone',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      {
        path: '',
        title: 'Dashboard — WP Clone',
        loadComponent: () => import('./pages/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'posts',
        title: 'Posts — WP Clone',
        data: { type: 'POST' },
        canActivate: [capGuard('edit_posts')],
        loadComponent: () => import('./pages/posts-list.page').then((m) => m.PostsListPage),
      },
      {
        path: 'posts/new',
        title: 'Add New Post — WP Clone',
        data: { type: 'POST' },
        canActivate: [capGuard('edit_posts')],
        loadComponent: () => import('./pages/post-editor.page').then((m) => m.PostEditorPage),
      },
      {
        path: 'posts/:id',
        title: 'Edit Post — WP Clone',
        data: { type: 'POST' },
        canActivate: [capGuard('edit_posts')],
        loadComponent: () => import('./pages/post-editor.page').then((m) => m.PostEditorPage),
      },
      {
        path: 'pages',
        title: 'Pages — WP Clone',
        data: { type: 'PAGE' },
        canActivate: [capGuard('edit_pages')],
        loadComponent: () => import('./pages/posts-list.page').then((m) => m.PostsListPage),
      },
      {
        path: 'pages/new',
        title: 'Add New Page — WP Clone',
        data: { type: 'PAGE' },
        canActivate: [capGuard('edit_pages')],
        loadComponent: () => import('./pages/post-editor.page').then((m) => m.PostEditorPage),
      },
      {
        path: 'pages/:id',
        title: 'Edit Page — WP Clone',
        data: { type: 'PAGE' },
        canActivate: [capGuard('edit_pages')],
        loadComponent: () => import('./pages/post-editor.page').then((m) => m.PostEditorPage),
      },
      {
        path: 'media',
        title: 'Media — WP Clone',
        canActivate: [capGuard('upload_files')],
        loadComponent: () => import('./pages/media.page').then((m) => m.MediaPage),
      },
      {
        path: 'comments',
        title: 'Comments — WP Clone',
        canActivate: [capGuard('moderate_comments')],
        loadComponent: () => import('./pages/comments.page').then((m) => m.CommentsPage),
      },
      {
        path: 'appearance/themes',
        title: 'Themes — WP Clone',
        canActivate: [capGuard('switch_themes')],
        loadComponent: () => import('./pages/themes.page').then((m) => m.ThemesPage),
      },
      {
        path: 'appearance/customizer',
        title: 'Customize — WP Clone',
        canActivate: [capGuard('edit_theme_options')],
        loadComponent: () => import('./pages/customizer.page').then((m) => m.CustomizerPage),
      },
      {
        path: 'appearance/menus',
        title: 'Menus — WP Clone',
        canActivate: [capGuard('edit_theme_options')],
        loadComponent: () => import('./pages/menus.page').then((m) => m.MenusPage),
      },
      {
        path: 'users',
        title: 'Users — WP Clone',
        canActivate: [capGuard('list_users')],
        loadComponent: () => import('./pages/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'settings',
        title: 'Settings — WP Clone',
        canActivate: [capGuard('manage_options')],
        loadComponent: () => import('./pages/settings.page').then((m) => m.SettingsPage),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
