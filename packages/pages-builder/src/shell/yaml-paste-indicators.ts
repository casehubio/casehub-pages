import { PageDocument } from '@casehubio/pages-document';
import { getNodeRange } from './yaml-path.js';

export interface PasteLineEntry {
  line: number;
  position: 'before' | 'after' | 'child';
  path: readonly (string | number)[];
}

export function computeValidPasteLines(doc: PageDocument, fragmentType: string): PasteLineEntry[] {
  const entries: PasteLineEntry[] = [];
  const yaml = doc.toString();
  const lineOffsets = computeLineOffsets(yaml);

  const pages = doc.getPages();
  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi]!;
    const pagePath: readonly (string | number)[] = ['pages', pi];

    if (fragmentType === 'component') {
      addChildEntry(entries, doc, pagePath, lineOffsets);

      const mode = page.getLayoutMode();
      if (mode === 'flat') {
        const comps = page.getComponents();
        for (let ci = 0; ci < comps.length; ci++) {
          const compPath: readonly (string | number)[] = ['pages', pi, 'components', ci];
          addSiblingEntries(entries, doc, compPath, lineOffsets);
        }
      }
    }
  }

  return entries;
}

function addChildEntry(
  entries: PasteLineEntry[],
  doc: PageDocument,
  path: readonly (string | number)[],
  lineOffsets: number[],
): void {
  const range = getNodeRange(doc, path);
  if (!range) return;
  const line = offsetToLine(range.from, lineOffsets);
  entries.push({ line, position: 'child', path });
}

function addSiblingEntries(
  entries: PasteLineEntry[],
  doc: PageDocument,
  path: readonly (string | number)[],
  lineOffsets: number[],
): void {
  const range = getNodeRange(doc, path);
  if (!range) return;
  const startLine = offsetToLine(range.from, lineOffsets);
  const endLine = offsetToLine(range.to, lineOffsets);
  entries.push({ line: startLine, position: 'before', path });
  entries.push({ line: endLine, position: 'after', path });
}

function computeLineOffsets(text: string): number[] {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') offsets.push(i + 1);
  }
  return offsets;
}

function offsetToLine(offset: number, lineOffsets: number[]): number {
  for (let i = lineOffsets.length - 1; i >= 0; i--) {
    if (lineOffsets[i]! <= offset) return i + 1;
  }
  return 1;
}
