import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { Editor, type ChainedCommands } from '@tiptap/core';
import CharacterCount from '@tiptap/extension-character-count';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { MediaSummary } from '@wp-clone/shared-types';
import { MatDialog } from '@angular/material/dialog';
import { Api } from '../core/api';
import { MediaPickerDialog } from './media-picker';

type ToolCmd =
  | 'bold' | 'italic' | 'strike' | 'underline'
  | 'h1' | 'h2' | 'h3'
  | 'bullet' | 'ordered' | 'quote' | 'code'
  | 'link' | 'image' | 'hr'
  | 'alignLeft' | 'alignCenter' | 'alignRight'
  | 'undo' | 'redo';

interface ToolBtn {
  cmd: ToolCmd;
  label: string;
  title: string;
  cls?: string;
}

const TOOLS: ToolBtn[] = [
  { cmd: 'h1', label: 'H1', title: 'Heading 1' },
  { cmd: 'h2', label: 'H2', title: 'Heading 2' },
  { cmd: 'h3', label: 'H3', title: 'Heading 3' },
  { cmd: 'bold', label: 'B', title: 'Bold (Ctrl+B)', cls: 'font-bold' },
  { cmd: 'italic', label: 'I', title: 'Italic (Ctrl+I)', cls: 'italic' },
  { cmd: 'strike', label: 'S', title: 'Strikethrough', cls: 'line-through' },
  { cmd: 'underline', label: 'U', title: 'Underline', cls: 'underline' },
  { cmd: 'bullet', label: '• List', title: 'Bullet list' },
  { cmd: 'ordered', label: '1. List', title: 'Numbered list' },
  { cmd: 'quote', label: '❝ Quote', title: 'Blockquote' },
  { cmd: 'code', label: '</>', title: 'Code block' },
  { cmd: 'link', label: 'Link', title: 'Insert link' },
  { cmd: 'image', label: 'Image', title: 'Insert image' },
  { cmd: 'hr', label: '—', title: 'Horizontal rule' },
  { cmd: 'alignLeft', label: '⟸', title: 'Align left' },
  { cmd: 'alignCenter', label: '↔', title: 'Align center' },
  { cmd: 'alignRight', label: '⟹', title: 'Align right' },
  { cmd: 'undo', label: '↶', title: 'Undo (Ctrl+Z)' },
  { cmd: 'redo', label: '↷', title: 'Redo (Ctrl+Y)' },
];

const EMPTY_DOC: Record<string, unknown> = { type: 'doc', content: [] };

/**
 * Standalone TipTap v3 editor. `content` is a two-way model carrying the
 * TipTap JSON document (exactly what the API persists and re-renders).
 */
@Component({
  selector: 'wp-tiptap',
  template: `
    <div class="overflow-hidden rounded border border-wp-border bg-white">
      <div class="flex flex-wrap items-center gap-0.5 border-b border-wp-gray-2 bg-wp-gray px-1.5 py-1.5">
        @for (t of tools; track t.cmd) {
          @if (t.cmd === 'h1' || t.cmd === 'bullet' || t.cmd === 'link' || t.cmd === 'alignLeft' || t.cmd === 'undo') {
            <span class="mx-1 h-4 w-px bg-wp-border" aria-hidden="true"></span>
          }
          <button
            type="button"
            class="rounded px-1.5 py-1 text-wp text-wp-ink hover:bg-wp-gray-2"
            [class]="(state()[t.cmd] ? 'is-active ' : '') + (t.cls ?? '')"
            [title]="t.title"
            [disabled]="disabled(t.cmd)"
            (click)="exec(t.cmd)"
          >
            {{ t.label }}
          </button>
        }
        <span class="ml-auto px-2 text-wp-sm text-wp-muted tabular-nums">
          {{ count() }} chars
        </span>
      </div>
      <div #host class="wp-editor-area min-h-56 px-4 py-3"></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .is-active {
      background: var(--color-wp-blue);
      color: #fff;
    }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
  `,
})
export class TiptapEditorComponent implements AfterViewInit, OnDestroy {
  /** TipTap JSON document (two-way). */
  content = model<Record<string, unknown>>(EMPTY_DOC);
  placeholder = input('Write your story…');

  private host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private dialog = inject(MatDialog);
  private api = inject(Api);

  editor: Editor | null = null;
  readonly tools = TOOLS;
  private tick = signal(0);

  readonly state = computed<Record<ToolCmd, boolean>>(() => {
    this.tick();
    const e = this.editor;
    const off = {
      bold: false, italic: false, strike: false, underline: false,
      h1: false, h2: false, h3: false, bullet: false, ordered: false,
      quote: false, code: false, link: false, image: false, hr: false,
      alignLeft: false, alignCenter: false, alignRight: false,
      undo: false, redo: false,
    };
    if (!e) return off;
    return {
      ...off,
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      underline: e.isActive('underline'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      code: e.isActive('codeBlock'),
      link: e.isActive('link'),
      image: e.isActive('image'),
      alignLeft: e.isActive({ textAlign: 'left' }),
      alignCenter: e.isActive({ textAlign: 'center' }),
      alignRight: e.isActive({ textAlign: 'right' }),
      undo: e.can().undo(),
      redo: e.can().redo(),
    };
  });

  readonly count = computed(() => {
    this.tick();
    const storage = this.editor?.storage as
      | { characterCount?: { characters: () => number } }
      | undefined;
    return storage?.characterCount?.characters() ?? 0;
  });

  ngAfterViewInit(): void {
    this.editor = new Editor({
      element: this.host().nativeElement,
      extensions: [
        StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
        Placeholder.configure({ placeholder: this.placeholder() }),
        CharacterCount,
        Highlight,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Image,
      ],
      content: this.content(),
      editorProps: { attributes: { class: 'wp-prosemirror' } },
      onUpdate: ({ editor }) => this.content.set(editor.getJSON()),
      onSelectionUpdate: () => this.tick.update((t) => t + 1),
      onTransaction: () => this.tick.update((t) => t + 1),
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
    this.editor = null;
  }

  disabled(cmd: ToolCmd): boolean {
    const s = this.state();
    if (cmd === 'undo') return !s.undo;
    if (cmd === 'redo') return !s.redo;
    return !this.editor;
  }

  exec(cmd: ToolCmd): void {
    const e = this.editor;
    if (!e) return;
    const chain: ChainedCommands = e.chain().focus();
    switch (cmd) {
      case 'bold': chain.toggleBold().run(); break;
      case 'italic': chain.toggleItalic().run(); break;
      case 'strike': chain.toggleStrike().run(); break;
      case 'underline': chain.toggleUnderline().run(); break;
      case 'h1': chain.toggleHeading({ level: 1 }).run(); break;
      case 'h2': chain.toggleHeading({ level: 2 }).run(); break;
      case 'h3': chain.toggleHeading({ level: 3 }).run(); break;
      case 'bullet': chain.toggleBulletList().run(); break;
      case 'ordered': chain.toggleOrderedList().run(); break;
      case 'quote': chain.toggleBlockquote().run(); break;
      case 'code': chain.toggleCodeBlock().run(); break;
      case 'hr': chain.setHorizontalRule().run(); break;
      case 'alignLeft': chain.setTextAlign('left').run(); break;
      case 'alignCenter': chain.setTextAlign('center').run(); break;
      case 'alignRight': chain.setTextAlign('right').run(); break;
      case 'undo': chain.undo().run(); break;
      case 'redo': chain.redo().run(); break;
      case 'link': this.toggleLink(); break;
      case 'image': this.pickImage(); break;
    }
  }

  private toggleLink(): void {
    const e = this.editor;
    if (!e) return;
    if (e.isActive('link')) {
      e.chain().focus().unsetLink().run();
      return;
    }
    const href = window.prompt('Link URL', 'https://');
    if (href) e.chain().focus().setLink({ href }).run();
  }

  private pickImage(): void {
    const ref = this.dialog.open(MediaPickerDialog, {
      data: { title: 'Insert an image' },
      width: '860px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe((m: MediaSummary | null) => {
      const e = this.editor;
      if (!m || !e) return;
      e.chain()
        .focus()
        .setImage({ src: this.api.abs(m.url), alt: m.altText ?? m.filename })
        .run();
    });
  }
}
