import { Component, input } from '@angular/core';

/**
 * Plain-HTML search form (`GET /search?q=…`). Works without JavaScript and
 * is fully crawlable; the router picks up the navigation on the client.
 */
@Component({
  selector: 'wp-search-form',
  template: `
    <form action="/search" method="get" role="search" [class]="formClass()">
      <label class="sr-only" for="wp-search-input">Search</label>
      <input
        id="wp-search-input"
        type="search"
        name="q"
        [placeholder]="placeholder()"
        autocomplete="off"
        [class]="inputClass()"
        style="border-color: color-mix(in srgb, var(--wp-text) 25%, var(--wp-bg))"
      />
      <button
        type="submit"
        [class]="buttonClass()"
        style="background: var(--wp-accent)"
      >
        Search
      </button>
    </form>
  `,
})
export class SearchFormComponent {
  placeholder = input('Search…');
  formClass = input('flex gap-2');
  inputClass = input(
    'flex-1 min-w-0 rounded-full border px-4 py-2 bg-transparent',
  );
  buttonClass = input('shrink-0 rounded-full px-4 py-2 font-semibold text-white');
}
