import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { AdminUser, Paged, RoleName } from '@wp-clone/shared-types';
import { Api } from '../core/api';
import { AuthService } from '../core/auth';
import { Notify } from '../core/notify';
import { Confirm } from '../shared/confirm';
import { formatDate } from '../shared/format';
import { PagerComponent } from '../shared/pager';

const ROLES: RoleName[] = ['ADMINISTRATOR', 'EDITOR', 'AUTHOR', 'CONTRIBUTOR', 'SUBSCRIBER'];

interface DialogData {
  user?: AdminUser | null;
}

@Component({
  selector: 'wp-user-dialog',
  imports: [FormsModule, MatDialogTitle, MatDialogContent, MatDialogActions],
  template: `
    <h2 mat-dialog-title>{{ data.user ? 'Edit User' : 'Add New User' }}</h2>
    <div mat-dialog-content class="grid min-w-[min(80vw,440px)] gap-3 pt-1">
      @if (!data.user) {
        <div>
          <label class="wp-label" for="u-username">Username <span class="text-wp-red">*</span></label>
          <input id="u-username" class="wp-input" autocomplete="off" [(ngModel)]="username" />
        </div>
      }
      <div>
        <label class="wp-label" for="u-email">Email <span class="text-wp-red">*</span></label>
        <input id="u-email" type="email" class="wp-input" autocomplete="off" [(ngModel)]="email" />
      </div>
      <div>
        <label class="wp-label" for="u-name">Display Name</label>
        <input id="u-name" class="wp-input" [(ngModel)]="displayName" />
      </div>
      <div>
        <label class="wp-label" for="u-pass">
          Password {{ data.user ? '(leave blank to keep current)' : '' }}
          @if (!data.user) { <span class="text-wp-red">*</span> }
        </label>
        <input id="u-pass" type="password" class="wp-input" autocomplete="new-password" [(ngModel)]="password" />
      </div>
      @if (data.user) {
        <div>
          <label class="wp-label" for="u-bio">Bio</label>
          <textarea id="u-bio" class="wp-input" rows="2" [(ngModel)]="bio"></textarea>
        </div>
      }
      <div>
        <label class="wp-label" for="u-role">Role</label>
        <select id="u-role" class="wp-input" [(ngModel)]="role">
          @for (r of roles; track r) {
            <option [value]="r">{{ label(r) }}</option>
          }
        </select>
      </div>
      @if (data.user) {
        <label class="flex items-center gap-2 text-wp">
          <input type="checkbox" class="accent-wp-blue" [(ngModel)]="isActive" />
          Active (user can log in)
        </label>
      }
      @if (error) {
        <p class="text-wp text-wp-red">{{ error }}</p>
      }
    </div>
    <div mat-dialog-actions align="end" class="gap-2">
      <button type="button" class="wp-btn" (click)="ref.close(null)">Cancel</button>
      <button type="button" class="wp-btn wp-btn-primary" [disabled]="busy" (click)="submit()">
        {{ busy ? 'Saving…' : data.user ? 'Update User' : 'Add New User' }}
      </button>
    </div>
  `,
})
export class UserDialog implements OnInit {
  readonly ref = inject<MatDialogRef<UserDialog, AdminUser | null>>(MatDialogRef);
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);
  private api = inject(Api);
  private notify = inject(Notify);

  readonly roles = ROLES;

  username = '';
  email = '';
  displayName = '';
  password = '';
  bio = '';
  role: RoleName = 'SUBSCRIBER';
  isActive = true;
  busy = false;
  error = '';

  ngOnInit(): void {
    const u = this.data.user;
    if (u) {
      this.username = u.username;
      this.email = u.email;
      this.displayName = u.displayName;
      this.bio = u.bio ?? '';
      this.role = u.role;
      this.isActive = u.isActive;
    }
  }

  label(r: RoleName): string {
    return r.charAt(0) + r.slice(1).toLowerCase();
  }

  submit(): void {
    if (this.busy) return;
    this.error = '';

    if (this.data.user) {
      const body: Record<string, unknown> = {
        email: this.email.trim(),
        displayName: this.displayName.trim() || this.username,
        bio: this.bio,
        role: this.role,
        isActive: this.isActive,
      };
      if (this.password) body['password'] = this.password;
      this.busy = true;
      this.api.patch<AdminUser>(`/users/${this.data.user.id}`, body).subscribe({
        next: (u) => {
          this.busy = false;
          this.ref.close(u);
        },
        error: (err: unknown) => {
          this.busy = false;
          this.error = extract(err);
          this.notify.error(err);
        },
      });
      return;
    }

    if (!this.username.trim() || !this.email.trim() || this.password.length < 8) {
      this.error = 'Username, email and a password of at least 8 characters are required.';
      return;
    }
    this.busy = true;
    this.api
      .post<AdminUser>('/users', {
        username: this.username.trim(),
        email: this.email.trim(),
        password: this.password,
        displayName: this.displayName.trim() || this.username.trim(),
        role: this.role,
      })
      .subscribe({
        next: (u) => {
          this.busy = false;
          this.ref.close(u);
        },
        error: (err: unknown) => {
          this.busy = false;
          this.error = extract(err);
          this.notify.error(err);
        },
      });
  }
}

function extract(err: unknown): string {
  const body = (err as { error?: { message?: string | string[] } }).error;
  if (Array.isArray(body?.message)) return body.message.join(', ');
  return body?.message ?? 'Save failed';
}

@Component({
  selector: 'wp-users-page',
  imports: [FormsModule, PagerComponent],
  template: `
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <h1 class="mb-0">Users</h1>
      <button type="button" class="wp-btn" (click)="openDialog()">+ Add New</button>
      <label class="ml-auto flex items-center gap-2 text-wp">
        Role:
        <select class="wp-input w-40" [value]="roleFilter()" (change)="setRole($event)">
          <option value="">All roles</option>
          @for (r of roles; track r) {
            <option [value]="r">{{ label(r) }}</option>
          }
        </select>
      </label>
    </div>

    @if (loading()) {
      <p class="py-10 text-center text-wp-muted">Loading…</p>
    } @else {
      <div class="wp-box overflow-x-auto">
        <table class="wp-table">
          <thead>
            <tr>
              <th>Username</th>
              <th class="hidden md:table-cell">Name</th>
              <th class="hidden sm:table-cell">Email</th>
              <th>Role</th>
              <th class="hidden lg:table-cell">Status</th>
              <th class="hidden xl:table-cell">Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (u of rows(); track u.id) {
              <tr>
                <td>
                  <span class="font-semibold text-wp-ink">{{ u.username }}</span>
                  @if (u.id === selfId) {
                    <span class="wp-pill ml-2">You</span>
                  }
                </td>
                <td class="hidden md:table-cell text-wp">{{ u.displayName }}</td>
                <td class="hidden sm:table-cell text-wp">
                  <a [href]="'mailto:' + u.email">{{ u.email }}</a>
                </td>
                <td>
                  <span class="wp-pill" [class.wp-pill-published]="u.role === 'ADMINISTRATOR'">{{ label(u.role) }}</span>
                </td>
                <td class="hidden lg:table-cell">
                  @if (u.isActive) {
                    <span class="text-wp-green">Active</span>
                  } @else {
                    <span class="text-wp-red">Inactive</span>
                  }
                </td>
                <td class="hidden xl:table-cell text-wp text-wp-muted whitespace-nowrap">{{ formatDate(u.createdAt) }}</td>
                <td class="whitespace-nowrap">
                  <button type="button" class="wp-btn-plain wp-btn" (click)="openDialog(u)">Edit</button>
                  @if (u.id !== selfId && canDelete) {
                    <button type="button" class="wp-btn-plain wp-btn !text-wp-red" (click)="remove(u)">Delete</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="py-8 text-center text-wp-muted">No users found.</td></tr>
            }
          </tbody>
        </table>
      </div>

      <wp-pager [page]="page()" [total]="total()" [perPage]="20" (pageChange)="load($event)" />
    }
  `,
})
export class UsersPage {
  private api = inject(Api);
  private notify = inject(Notify);
  private confirm = inject(Confirm);
  private dialog = inject(MatDialog);
  private auth = inject(AuthService);

  readonly roles = ROLES;
  readonly rows = signal<AdminUser[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly roleFilter = signal('');

  readonly selfId = this.auth.user()?.id ?? '';
  readonly canDelete = this.auth.can('delete_users');

  readonly label = (r: RoleName) => r.charAt(0) + r.slice(1).toLowerCase();
  readonly formatDate = formatDate;

  constructor() {
    this.load(1);
  }

  setRole(event: Event): void {
    this.roleFilter.set((event.target as HTMLSelectElement).value);
    this.load(1);
  }

  load(page: number): void {
    this.loading.set(true);
    this.api
      .get<Paged<AdminUser>>('/users', {
        page,
        perPage: 20,
        role: this.roleFilter() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.items);
          this.total.set(res.total);
          this.page.set(res.page);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.notify.error(err);
          this.loading.set(false);
        },
      });
  }

  openDialog(user?: AdminUser): void {
    const ref = this.dialog.open(UserDialog, {
      data: { user: user ?? null },
      width: '520px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe((result: AdminUser | null) => {
      if (!result) return;
      if (user) {
        this.rows.update((list) => list.map((u) => (u.id === result.id ? result : u)));
        if (result.id === this.selfId) this.auth.user.update((me) => (me ? { ...me, displayName: result.displayName, email: result.email, role: result.role } : me));
        this.notify.ok('User updated');
      } else {
        this.load(1);
        this.notify.ok(`User “${result.username}” created`);
      }
    });
  }

  async remove(u: AdminUser): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Delete ${u.username}?`,
      message: 'The account is removed permanently. Their posts remain.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.api.delete(`/users/${u.id}`).subscribe({
      next: () => {
        this.rows.update((list) => list.filter((x) => x.id !== u.id));
        this.total.update((t) => Math.max(0, t - 1));
        this.notify.ok('User deleted');
      },
      error: (err: unknown) => this.notify.error(err),
    });
  }
}
