import { Injectable, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { Component } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

@Component({
  selector: 'wp-confirm-dialog',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <div mat-dialog-content class="text-wp text-wp-ink leading-relaxed">{{ data.message }}</div>
    <div mat-dialog-actions align="end" class="gap-2">
      <button type="button" class="wp-btn" (click)="ref.close(false)">Cancel</button>
      <button
        type="button"
        class="wp-btn"
        [class.wp-btn-danger]="data.danger"
        [class.wp-btn-primary]="!data.danger"
        (click)="ref.close(true)"
      >
        {{ data.confirmLabel ?? 'OK' }}
      </button>
    </div>
  `,
})
export class ConfirmDialog {
  ref = inject(MatDialogRef<ConfirmDialog, boolean>);
  data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
}

/** Promise-based confirm() backed by a Material dialog. */
@Injectable({ providedIn: 'root' })
export class Confirm {
  private dialog = inject(MatDialog);

  ask(opts: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialog, {
      data: opts,
      width: '440px',
      maxWidth: '95vw',
    });
    return firstValueFrom(ref.afterClosed()).then((v) => v === true);
  }
}
