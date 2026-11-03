import { Component, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import type { MenuItemDto } from '@wp-clone/shared-types';

/** Accessible nav menu rendered from a MenuDto (one nesting level). */
@Component({
  selector: 'wp-nav-menu',
  imports: [RouterModule],
  template: `
    <ul [class]="listClass()">
      @for (item of items(); track item.id) {
        <li class="relative group">
          <a [href]="item.url || '/'" class="block px-3 py-2 hover:underline underline-offset-4">
            {{ item.label }}
          </a>
          @if (item.children?.length) {
            <ul class="hidden group-hover:block group-focus-within:block absolute left-0 top-full min-w-44 z-20 shadow-lg py-1"
                [style.background]="'var(--wp-bg)'" [style.border]="'1px solid color-mix(in srgb, var(--wp-text) 12%, var(--wp-bg))'">
              @for (child of item.children; track child.id) {
                <li>
                  <a [href]="child.url || '/'" class="block px-4 py-2 whitespace-nowrap hover:underline">
                    {{ child.label }}
                  </a>
                </li>
              }
            </ul>
          }
        </li>
      }
    </ul>
  `,
})
export class NavMenuComponent {
  items = input.required<MenuItemDto[]>();
  listClass = input('flex flex-wrap');
}
