import { NgComponentOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { PageState } from './core/page-state';

/**
 * The single route component. The resolver picks the ACTIVE theme's root
 * component (lazy chunk) and fills PageState before this renders, so the
 * server serializes the fully themed page — and switching themes swaps
 * the entire frontend.
 */
@Component({
  selector: 'wp-theme-outlet',
  imports: [NgComponentOutlet],
  template: `
    @if (page.themeComponent(); as comp) {
      <ng-container *ngComponentOutlet="comp" />
    } @else {
      <div class="min-h-screen grid place-items-center opacity-60">Loading…</div>
    }
  `,
})
export class ThemeOutlet {
  page = inject(PageState);
}
