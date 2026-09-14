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

export const EDITABLE_TEXT: unique symbol = Symbol.for('scenario-editable-text') as any;

export function isEditableText(el: Element): el is Element & { [EDITABLE_TEXT]: ScenarioEditableText } {
  return EDITABLE_TEXT in el;
}

export function findEditableText(el: Element): ScenarioEditableText | null {
  let current: Element | null = el;
  while (current) {
    if (isEditableText(current)) return current[EDITABLE_TEXT];
    const root = current.getRootNode();
    if (root instanceof ShadowRoot) {
      current = root.host;
    } else {
      current = current.parentElement;
    }
  }
  return null;
}
