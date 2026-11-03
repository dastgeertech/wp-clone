import { Component, input } from '@angular/core';
import type { MediaSummary } from '@wp-clone/shared-types';

/**
 * Server-rendered responsive <picture>: WebP srcset from the API-generated
 * variants with an original fallback. Always emits width/height so the
 * browser reserves space (zero CLS); lazy by default, eager for the LCP image.
 */
@Component({
  selector: 'wp-image',
  template: `
    @if (srcset()) {
      <picture>
        <source type="image/webp" [attr.srcset]="srcset()" [attr.sizes]="sizes()" />
        <img [src]="fallback()" [attr.alt]="alt()" [attr.width]="media()?.width"
             [attr.height]="media()?.height" [attr.sizes]="sizes()"
             [attr.loading]="eager() ? null : 'lazy'" [attr.fetchpriority]="eager() ? 'high' : null"
             decoding="async" [class]="imgClass()" />
      </picture>
    } @else if (fallback()) {
      <img [src]="fallback()" [attr.alt]="alt()" [attr.width]="media()?.width"
           [attr.height]="media()?.height"
           [attr.loading]="eager() ? null : 'lazy'" [attr.fetchpriority]="eager() ? 'high' : null"
           decoding="async" [class]="imgClass()" />
    }
  `,
  styles: `
    :host { display: block; }
    img { display: block; width: 100%; height: auto; object-fit: cover; }
  `,
})
export class ResponsiveImageComponent {
  media = input.required<MediaSummary | null | undefined>();
  sizes = input('(min-width: 1024px) 33vw, 100vw');
  eager = input(false);
  imgClass = input('');

  srcset() {
    const webp = this.media()?.variants?.webp;
    if (!webp) return null;
    return Object.entries(webp)
      .map(([w, url]) => `${url} ${w}w`)
      .join(', ');
  }
  fallback() {
    const m = this.media();
    if (!m) return '';
    return m.variants.original || m.url;
  }
  alt() {
    return this.media()?.altText ?? '';
  }
}
