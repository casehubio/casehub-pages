import { describe, it, expect } from 'vitest';
import { PageDocument } from '@casehubio/pages-document';
import { computeValidPasteLines } from './yaml-paste-indicators.js';

const FLAT_PAGE = `pages:
- name: Dashboard
  components:
  - type: metric
  - type: bar-chart
`;

describe('computeValidPasteLines', () => {
  it('returns line numbers where a component can be pasted', () => {
    const doc = PageDocument.parse(FLAT_PAGE);
    const lines = computeValidPasteLines(doc, 'component');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('includes lines near existing components for sibling insert', () => {
    const doc = PageDocument.parse(FLAT_PAGE);
    const yaml = doc.toString();
    const lines = computeValidPasteLines(doc, 'component');
    const metricLineNum = yaml.split('\n').findIndex(l => l.includes('type: metric')) + 1;
    expect(lines.some(l => Math.abs(l.line - metricLineNum) <= 1)).toBe(true);
  });

  it('each result has a line number and position', () => {
    const doc = PageDocument.parse(FLAT_PAGE);
    const lines = computeValidPasteLines(doc, 'component');
    for (const entry of lines) {
      expect(entry.line).toBeGreaterThan(0);
      expect(['before', 'after', 'child']).toContain(entry.position);
    }
  });

  it('returns empty for unrecognized fragment type', () => {
    const doc = PageDocument.parse(FLAT_PAGE);
    const lines = computeValidPasteLines(doc, 'unknown');
    expect(lines).toHaveLength(0);
  });

  describe('grid/items mode pages', () => {
    const ITEMS_PAGE = `pages:
- name: Grid Page
  items:
  - placement: { x: 0, y: 0, w: 6, h: 2 }
    component:
      type: chart
  - placement: { x: 6, y: 0, w: 6, h: 1 }
    component:
      type: table
`;

    const GRID_PAGE = `pages:
- name: Grid Page
  grid:
  - at: { x: 0, y: 0, w: 6, h: 2 }
    type: chart
  - at: { x: 6, y: 0, w: 6, h: 1 }
    type: table
`;

    it('generates sibling entries for items: mode', () => {
      const doc = PageDocument.parse(ITEMS_PAGE);
      const lines = computeValidPasteLines(doc, 'component');
      const siblings = lines.filter(l => l.position === 'before' || l.position === 'after');
      expect(siblings.length).toBeGreaterThanOrEqual(2);
    });

    it('generates child entry on page node for items: mode', () => {
      const doc = PageDocument.parse(ITEMS_PAGE);
      const lines = computeValidPasteLines(doc, 'component');
      const children = lines.filter(l => l.position === 'child');
      expect(children).toHaveLength(1);
    });

    it('generates sibling entries for grid: mode', () => {
      const doc = PageDocument.parse(GRID_PAGE);
      const lines = computeValidPasteLines(doc, 'component');
      const siblings = lines.filter(l => l.position === 'before' || l.position === 'after');
      expect(siblings.length).toBeGreaterThanOrEqual(2);
    });

    it('sibling paths reference correct item indices', () => {
      const doc = PageDocument.parse(ITEMS_PAGE);
      const lines = computeValidPasteLines(doc, 'component');
      const siblings = lines.filter(l => l.position === 'before' || l.position === 'after');
      const paths = siblings.map(l => l.path);
      expect(paths.some(p => p[2] === 'items' && p[3] === 0)).toBe(true);
      expect(paths.some(p => p[2] === 'items' && p[3] === 1)).toBe(true);
    });
  });
});
