import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

/** Guest comment form with honeypot + moderation feedback. */
@Component({
  selector: 'wp-comment-form',
  imports: [FormsModule],
  template: `
    <form (submit)="submit($event)" class="space-y-3" novalidate>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="block text-sm font-medium mb-1">Name *</span>
          <input name="authorName" required [(ngModel)]="name" [disabled]="busy()"
                 class="w-full rounded border px-3 py-2 bg-transparent" />
        </label>
        <label class="block">
          <span class="block text-sm font-medium mb-1">Email *</span>
          <input name="authorEmail" type="email" required [(ngModel)]="email" [disabled]="busy()"
                 class="w-full rounded border px-3 py-2 bg-transparent" />
        </label>
      </div>
      <label class="block">
        <span class="block text-sm font-medium mb-1">Website</span>
        <input name="authorUrl" type="url" [(ngModel)]="url" [disabled]="busy()"
               class="w-full rounded border px-3 py-2 bg-transparent" />
      </label>
      <label class="block">
        <span class="block text-sm font-medium mb-1">Comment *</span>
        <textarea name="content" required rows="5" [(ngModel)]="content" [disabled]="busy()"
                  class="w-full rounded border px-3 py-2 bg-transparent"></textarea>
      </label>

      <!-- Honeypot: invisible to humans, irresistible to bots -->
      <div class="hidden" aria-hidden="true">
        <label>Website<input name="website" tabindex="-1" autocomplete="off" [(ngModel)]="website" /></label>
      </div>

      @if (error()) {
        <p class="text-sm" style="color: var(--wp-accent)" role="alert">{{ error() }}</p>
      }
      @if (status() === 'pending') {
        <p class="text-sm opacity-70" role="status">
          Your comment is awaiting moderation. It will appear once approved.
        </p>
      }
      @if (status() === 'approved') {
        <p class="text-sm" style="color: var(--wp-accent)" role="status">Comment posted — thank you!</p>
      }
      @if (status() === 'spam') {
        <p class="text-sm opacity-70" role="status">Thanks — your comment was received.</p>
      }

      <button type="submit" [disabled]="busy()"
              class="px-5 py-2.5 rounded-full font-semibold text-white transition-colors disabled:opacity-50"
              [style.background]="'var(--wp-accent)'">
        {{ busy() ? 'Posting…' : 'Post Comment' }}
      </button>
    </form>
  `,
  styles: `
    input, textarea {
      border-color: color-mix(in srgb, var(--wp-text) 25%, var(--wp-bg));
      color: var(--wp-text);
    }
    input:focus, textarea:focus { outline: 2px solid var(--wp-accent); outline-offset: 1px; border-color: transparent; }
  `,
})
export class CommentFormComponent {
  private http = inject(HttpClient);

  postId = input.required<string>();

  name = '';
  email = '';
  url = '';
  content = '';
  website = '';

  busy = signal(false);
  error = signal<string | null>(null);
  status = signal<'approved' | 'pending' | 'spam' | null>(null);

  async submit(event: Event) {
    event.preventDefault();
    if (this.busy()) return;
    this.error.set(null);
    this.status.set(null);

    if (!this.name.trim() || !this.email.trim() || !this.content.trim()) {
      this.error.set('Please fill in name, email and comment.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      this.error.set('Please enter a valid email address.');
      return;
    }

    this.busy.set(true);
    try {
      const res = await fetch(`${environment.apiUrl}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          postId: this.postId(),
          authorName: this.name.trim(),
          authorEmail: this.email.trim(),
          authorUrl: this.url.trim() || undefined,
          content: this.content.trim(),
          website: this.website, // honeypot — must stay empty
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const body = (await res.json()) as { status: 'approved' | 'pending' | 'spam' };
      this.status.set(body.status);
      this.content = '';
      this.website = '';
    } catch {
      this.error.set('Something went wrong. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
