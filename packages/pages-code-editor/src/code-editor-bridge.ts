import { EditorView, Decoration, type DecorationSet } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';

export interface Position {
  line: number;
  col: number;
}

export interface ScenarioEditableText {
  insertText(text: string): void;
  replaceRange(from: Position, to: Position, text: string): void;
  deleteRange(from: Position, to: Position): void;
  setCursor(line: number, col: number): void;
  getCursor(): Position;
  getText(): string;
  getLineCount(): number;
  setContent(text: string): void;
  highlight(from: Position, to: Position, style?: 'pulse' | 'underline' | 'glow'): void;
  clearHighlights(): void;
  triggerCompletion?(): void;
  selectCompletion?(label: string): boolean;
}

const addHighlight = StateEffect.define<{ from: number; to: number; class: string }>();
const clearAllHighlights = StateEffect.define<null>();

const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(addHighlight)) {
        decorations = decorations.update({
          add: [Decoration.mark({ class: e.value.class }).range(e.value.from, e.value.to)],
        });
      } else if (e.is(clearAllHighlights)) {
        decorations = Decoration.none;
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export class CodeEditorBridge implements ScenarioEditableText {
  private _highlightFieldInstalled = false;

  constructor(private readonly view: EditorView) {}

  private toOffset(pos: Position): number {
    const line = this.view.state.doc.line(pos.line);
    return line.from + pos.col;
  }

  private toPosition(offset: number): Position {
    const line = this.view.state.doc.lineAt(offset);
    return { line: line.number, col: offset - line.from };
  }

  insertText(text: string): void {
    const cursor = this.view.state.selection.main.head;
    this.view.dispatch({ changes: { from: cursor, insert: text } });
  }

  replaceRange(from: Position, to: Position, text: string): void {
    this.view.dispatch({
      changes: { from: this.toOffset(from), to: this.toOffset(to), insert: text },
    });
  }

  deleteRange(from: Position, to: Position): void {
    this.view.dispatch({
      changes: { from: this.toOffset(from), to: this.toOffset(to) },
    });
  }

  setCursor(line: number, col: number): void {
    const anchor = this.toOffset({ line, col });
    this.view.dispatch({ selection: { anchor } });
  }

  getCursor(): Position {
    return this.toPosition(this.view.state.selection.main.head);
  }

  getText(): string {
    return this.view.state.doc.toString();
  }

  getLineCount(): number {
    return this.view.state.doc.lines;
  }

  setContent(text: string): void {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: text },
    });
  }

  highlight(from: Position, to: Position, style: string = 'pulse'): void {
    if (!this._highlightFieldInstalled) {
      this.view.dispatch({ effects: StateEffect.appendConfig.of([highlightField]) });
      this._highlightFieldInstalled = true;
    }
    this.view.dispatch({
      effects: addHighlight.of({
        from: this.toOffset(from),
        to: this.toOffset(to),
        class: `scenario-highlight-${style}`,
      }),
    });
  }

  clearHighlights(): void {
    if (this._highlightFieldInstalled) {
      this.view.dispatch({ effects: clearAllHighlights.of(null) });
    }
  }
}
