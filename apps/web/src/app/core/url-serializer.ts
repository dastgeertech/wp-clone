import { Injectable } from '@angular/core';
import { DefaultUrlSerializer, PRIMARY_OUTLET, UrlTree } from '@angular/router';

/**
 * WordPress permalinks always end with a trailing slash (`/%postname%/`).
 * Angular's parser turns that slash into an extra EMPTY url segment
 * (`/about/` -> `["about", ""]`), which `defaultUrlMatcher` never consumes —
 * so `:slug` routes would never match and every permalink would fall through
 * to the wildcard and render a 404.
 *
 * This serializer strips the empty segment on parse and re-adds the slash on
 * serialize, keeping the router, the address bar, `<link rel=canonical>` and
 * the server-rendered HTML all in agreement on the WordPress URL form.
 */
@Injectable()
export class WpUrlSerializer extends DefaultUrlSerializer {
  override parse(url: string): UrlTree {
    const tree = super.parse(url);
    const primary = tree.root.children[PRIMARY_OUTLET];
    if (primary) {
      while (
        primary.segments.length &&
        primary.segments[primary.segments.length - 1].path === ''
      ) {
        primary.segments.pop();
      }
    }
    return tree;
  }

  override serialize(tree: UrlTree): string {
    const url = super.serialize(tree);
    const cut = url.search(/[?#]/);
    const path = cut === -1 ? url : url.slice(0, cut);
    const rest = cut === -1 ? '' : url.slice(cut);
    // Keep the WordPress canonical form: `/about` -> `/about/`, but `/` stays.
    return path.length > 1 && !path.endsWith('/') ? `${path}/${rest}` : url;
  }
}
