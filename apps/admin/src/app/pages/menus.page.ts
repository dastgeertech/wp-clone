import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuDto, MenuItemDto } from '@wp-clone/shared-types';
import { Api } from '../core/api';
import { Notify } from '../core/notify';
import { Confirm } from '../shared/confirm';

/** A menu item as edited in the UI (order implied by array index). */
interface Node {
  label: string;
  url: string;
  children: Node[];
}

/** Flattened row with everything the buttons need (parent list + depth). */
interface Row {
  node: Node;
  list: Node[];
  index: number;
  depth: number;
  parent: Row | null;
}

const LOCATIONS = [
  { value: '', label: '(no location)' },
  { value: 'primary', label: 'Primary' },
  { value: 'footer', label: 'Footer' },
];

@Component({
  selector: 'wp-menus-page',
  imports: [FormsModule],
  template: `
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <h1 class="mb-0">Menus</h1>
      <select class="wp-input w-56" [value]="selectedId()" (change)="pickMenu($event)" aria-label="Select menu">
        @for (m of menus(); track m.id) {
          <option [value]="m.id">{{ m.name }}{{ m.location ? ' (' + m.location + ')' : '' }}</option>
        }
        @if (menus().length === 0) {
          <option value="">(no menus)</option>
        }
      </select>
      <button type="button" class="wp-btn" (click)="createMenu()">+ Create Menu</button>
      @if (selectedId()) {
        <button type="button" class="wp-btn !border-wp-red !text-wp-red" (click)="removeMenu()">Delete Menu</button>
      }
    </div>

    @if (loading()) {
      <p class="py-10 text-center text-wp-muted">Loading…</p>
    } @else if (!selectedId()) {
      <div class="wp-box p-10 text-center text-wp-muted">
        No menu selected — create one to start building navigation.
      </div>
    } @else {
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <!-- structure -->
        <div class="wp-box p-4">
          <div class="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label class="wp-label" for="menuName">Menu Name</label>
              <input id="menuName" class="wp-input" [(ngModel)]="name" />
            </div>
            <div>
              <label class="wp-label" for="menuLoc">Display Location</label>
              <select id="menuLoc" class="wp-input" [(ngModel)]="location">
                @for (l of locations; track l.value) {
                  <option [value]="l.value">{{ l.label }}</option>
                }
              </select>
            </div>
          </div>

          <h3 class="mb-2">Menu Structure</h3>
          @if (rows().length === 0) {
            <p class="mb-3 text-wp text-wp-muted">No items yet — add some on the right.</p>
          }
          <ul class="grid gap-2">
            @for (r of rows(); track $index) {
              <li
                class="rounded border border-wp-border bg-white p-2"
                [style.marginLeft.px]="r.depth * 24"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-wp-sm text-wp-muted select-none">⠿</span>
                  <input
                    class="wp-input min-w-40 flex-1"
                    [(ngModel)]="r.node.label"
                    aria-label="Item label"
                    placeholder="Label"
                  />
                  <input
                    class="wp-input min-w-44 flex-1 font-mono text-wp-sm"
                    [(ngModel)]="r.node.url"
                    aria-label="Item URL"
                    placeholder="/path/ or https://…"
                  />
                  <div class="flex gap-1">
                    <button type="button" class="wp-btn px-2" title="Move up" [disabled]="r.index === 0" (click)="move(r, -1)">↑</button>
                    <button type="button" class="wp-btn px-2" title="Move down" [disabled]="r.index === r.list.length - 1" (click)="move(r, 1)">↓</button>
                    <button type="button" class="wp-btn px-2" title="Indent under previous" [disabled]="!canIndent(r)" (click)="indent(r)">→</button>
                    <button type="button" class="wp-btn px-2" title="Outdent" [disabled]="!canOutdent(r)" (click)="outdent(r)">←</button>
                    <button type="button" class="wp-btn px-2 !border-wp-red !text-wp-red" title="Remove" (click)="removeItem(r)">✕</button>
                  </div>
                </div>
              </li>
            }
          </ul>

          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="wp-btn wp-btn-primary" [disabled]="busy()" (click)="save()">
              {{ busy() ? 'Saving…' : 'Save Menu' }}
            </button>
            <span class="self-center text-wp-sm text-wp-muted">
              Indent (→) nests an item under the one above it.
            </span>
          </div>
        </div>

        <!-- add items -->
        <aside class="wp-box h-fit p-4">
          <h3 class="mb-3">Add Items</h3>
          <label class="wp-label" for="itemLabel">Label</label>
          <input id="itemLabel" class="wp-input mb-2" [(ngModel)]="newLabel" placeholder="e.g. About" />
          <label class="wp-label" for="itemUrl">URL</label>
          <input id="itemUrl" class="wp-input mb-2" [(ngModel)]="newUrl" placeholder="/about/ or https://…" />
          <button type="button" class="wp-btn w-full" (click)="addItem()">+ Add to Menu</button>
          <p class="mt-3 text-wp-sm text-wp-muted">
            Use site paths like <code class="bg-wp-gray-2 px-1">/hello-world/</code> — the
            trailing slash matches the site’s permalink structure.
          </p>
        </aside>
      </div>
    }
  `,
})
export class MenusPage {
  private api = inject(Api);
  private notify = inject(Notify);
  private confirm = inject(Confirm);

  readonly menus = signal<MenuDto[]>([]);
  readonly selectedId = signal('');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly rows = signal<Row[]>([]);
  readonly locations = LOCATIONS;

  name = '';
  location = '';
  newLabel = '';
  newUrl = '';

  private nodes: Node[] = [];

  constructor() {
    this.api.get<MenuDto[]>('/menus').subscribe({
      next: (list) => {
        this.menus.set(list);
        this.loading.set(false);
        if (list.length) this.select(list[0].id);
        else this.rebuild();
      },
      error: (err: unknown) => {
        this.notify.error(err);
        this.loading.set(false);
      },
    });
  }

  pickMenu(event: Event): void {
    this.select((event.target as HTMLSelectElement).value);
  }

  select(id: string): void {
    if (!id) return;
    this.selectedId.set(id);
    this.loading.set(true);
    this.api.get<MenuDto>(`/menus/${id}`).subscribe({
      next: (menu) => {
        this.name = menu.name;
        this.location = menu.location ?? '';
        this.nodes = (menu.items ?? []).map(toNode);
        this.rebuild();
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.notify.error(err);
        this.loading.set(false);
      },
    });
  }

  createMenu(): void {
    const name = window.prompt('Name the new menu:', 'New Menu');
    if (!name?.trim()) return;
    this.api.post<MenuDto>('/menus', { name: name.trim(), location: '', items: [] }).subscribe({
      next: (menu) => {
        this.menus.update((list) => [...list, menu]);
        this.select(menu.id);
        this.notify.ok('Menu created');
      },
      error: (err: unknown) => this.notify.error(err),
    });
  }

  async removeMenu(): Promise<void> {
    const id = this.selectedId();
    if (!id) return;
    const ok = await this.confirm.ask({
      title: 'Delete this menu?',
      message: 'Its items will be removed. Pages/posts are not affected.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.api.delete(`/menus/${id}`).subscribe({
      next: () => {
        const rest = this.menus().filter((m) => m.id !== id);
        this.menus.set(rest);
        this.selectedId.set('');
        this.nodes = [];
        this.rebuild();
        this.notify.ok('Menu deleted');
        if (rest.length) this.select(rest[0].id);
      },
      error: (err: unknown) => this.notify.error(err),
    });
  }

  addItem(): void {
    const label = this.newLabel.trim();
    if (!label) return;
    this.nodes.push({ label, url: this.newUrl.trim() || '/', children: [] });
    this.newLabel = '';
    this.newUrl = '';
    this.rebuild();
  }

  removeItem(r: Row): void {
    r.list.splice(r.index, 1);
    this.rebuild();
  }

  move(r: Row, dir: -1 | 1): void {
    const target = r.index + dir;
    if (target < 0 || target >= r.list.length) return;
    const [node] = r.list.splice(r.index, 1);
    r.list.splice(target, 0, node);
    this.rebuild();
  }

  canIndent(r: Row): boolean {
    return r.index > 0 && !r.list[r.index - 1].children.includes(r.node);
  }

  indent(r: Row): void {
    if (!this.canIndent(r)) return;
    const [node] = r.list.splice(r.index, 1);
    r.list[r.index - 1].children.push(node);
    this.rebuild();
  }

  canOutdent(r: Row): boolean {
    return r.parent !== null;
  }

  outdent(r: Row): void {
    const parent = r.parent;
    if (!parent) return;
    const grand = parent.list;
    const parentIndex = parent.index;
    const [node] = r.list.splice(r.index, 1);
    grand.splice(parentIndex + 1, 0, node);
    this.rebuild();
  }

  save(): void {
    if (!this.selectedId() || this.busy()) return;
    this.busy.set(true);
    const items = this.nodes.map((n, i) => toDto(n, i));
    this.api
      .patch<MenuDto>(`/menus/${this.selectedId()}`, {
        name: this.name.trim() || 'Menu',
        location: this.location || null,
        items,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.menus.update((list) =>
            list.map((m) =>
              m.id === this.selectedId()
                ? { ...m, name: this.name.trim() || 'Menu', location: this.location || null }
                : m,
            ),
          );
          this.notify.ok('Menu saved');
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.notify.error(err);
        },
      });
  }

  private rebuild(): void {
    this.rows.set(flatten(this.nodes, 0, null));
  }
}

function flatten(list: Node[], depth: number, parent: Row | null): Row[] {
  const out: Row[] = [];
  list.forEach((node, index) => {
    const row: Row = { node, list, index, depth, parent };
    out.push(row);
    if (node.children.length) {
      out.push(...flatten(node.children, depth + 1, row));
    }
  });
  return out;
}

function toNode(item: MenuItemDto): Node {
  return {
    label: item.label,
    url: item.url ?? '',
    children: (item.children ?? []).map(toNode),
  };
}

function toDto(node: Node, order: number): Record<string, unknown> {
  return {
    label: node.label,
    url: node.url,
    order,
    children: node.children.map((c, i) => toDto(c, i)),
  };
}
