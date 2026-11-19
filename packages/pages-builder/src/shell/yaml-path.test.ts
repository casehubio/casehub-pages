import { describe, it, expect } from 'vitest';
import { PageDocument } from '@casehubio/pages-document';
import { findPathAtOffset, getNodeRange, classifyPath, getParentPath } from './yaml-path.js';

const FLAT_PAGE = `pages:
- name: Overview
  components:
  - type: title
    properties:
      text: Hello
  - type: bar-chart
    properties:
      subtype: column
`;

const WITH_DATASETS = `datasets:
- uuid: sales_tx
  name: Sales Transactions
  url: /api/sales
- uuid: analytics
  name: Analytics
pages:
- name: P
`;

const WITH_NAV = `pages:
- name: P
navTree:
  root_items:
  - type: GROUP
    id: main
    children:
    - type: ITEM
      page: P
`;

function offsetIn(doc: PageDocument, substring: string): number {
  return doc.toString().indexOf(substring);
}

// --- findPathAtOffset ---

describe('findPathAtOffset', () => {
  describe('flat page components', () => {
    it('cursor on "type: title" resolves to first component', () => {
      const doc = PageDocument.parse(FLAT_PAGE);
      const path = findPathAtOffset(doc, offsetIn(doc, 'type: title'));
      expect(path).toEqual(['pages', 0, 'components', 0]);
    });

    it('cursor on "type: bar-chart" resolves to second component', () => {
      const doc = PageDocument.parse(FLAT_PAGE);
      const path = findPathAtOffset(doc, offsetIn(doc, 'type: bar-chart'));
      expect(path).toEqual(['pages', 0, 'components', 1]);
    });

    it('cursor on "text: Hello" trims to first component', () => {
      const doc = PageDocument.parse(FLAT_PAGE);
      const path = findPathAtOffset(doc, offsetIn(doc, 'text: Hello'));
      expect(path).toEqual(['pages', 0, 'components', 0]);
    });

    it('cursor on "subtype: column" trims to second component', () => {
      const doc = PageDocument.parse(FLAT_PAGE);
      const path = findPathAtOffset(doc, offsetIn(doc, 'subtype: column'));
      expect(path).toEqual(['pages', 0, 'components', 1]);
    });
  });


  describe('datasets', () => {
    it('cursor on first dataset resolves to datasets[0]', () => {
      const doc = PageDocument.parse(WITH_DATASETS);
      const path = findPathAtOffset(doc, offsetIn(doc, 'uuid: sales_tx'));
      expect(path).toEqual(['datasets', 0]);
    });

    it('cursor on second dataset resolves to datasets[1]', () => {
      const doc = PageDocument.parse(WITH_DATASETS);
      const path = findPathAtOffset(doc, offsetIn(doc, 'uuid: analytics'));
      expect(path).toEqual(['datasets', 1]);
    });
  });

  describe('navigation', () => {
    it('cursor on nav item resolves to navTree path', () => {
      const doc = PageDocument.parse(WITH_NAV);
      const path = findPathAtOffset(doc, offsetIn(doc, 'id: main'));
      expect(path).toBeDefined();
      expect(path![0]).toBe('navTree');
    });
  });

  describe('edge cases', () => {
    it('offset 0 returns root-level path', () => {
      const doc = PageDocument.parse(FLAT_PAGE);
      const path = findPathAtOffset(doc, 0);
      expect(path).toBeDefined();
    });

    it('offset at end of file returns a path', () => {
      const doc = PageDocument.parse(FLAT_PAGE);
      const text = doc.toString();
      const path = findPathAtOffset(doc, text.length - 1);
      expect(path).toBeDefined();
    });
  });

  describe('demo YAML — correlations', () => {
    const DEMO_YAML = `pages:\n- name: Sales Dashboard\n  rows:\n  - columns:\n    - span: 4\n      components:\n      - type: metric\n        properties:\n          title: Total Revenue\n          lookup:\n            uuid: sales_tx\n    - span: 4\n      components:\n      - type: metric\n        properties:\n          title: Active Users\n          lookup:\n            uuid: analytics\n`;

    it('first uuid: sales_tx resolves to Total Revenue component', () => {
      const doc = PageDocument.parse(DEMO_YAML);
      const path = findPathAtOffset(doc, offsetIn(doc, 'uuid: sales_tx'));
      expect(path).toBeDefined();
      expect(classifyPath(path!)).toBe('component');
      expect(path![path!.indexOf('columns') + 1]).toBe(0);
    });

    it('Total Revenue range does not include Active Users', () => {
      const doc = PageDocument.parse(DEMO_YAML);
      const path = findPathAtOffset(doc, offsetIn(doc, 'uuid: sales_tx'));
      const range = getNodeRange(doc, path!);
      expect(range).toBeDefined();
      const text = doc.toString().slice(range!.from, range!.to);
      expect(text).toContain('Total Revenue');
      expect(text).not.toContain('Active Users');
    });

    it('Active Users range does not include Total Revenue', () => {
      const doc = PageDocument.parse(DEMO_YAML);
      const path = findPathAtOffset(doc, offsetIn(doc, 'title: Active Users'));
      const range = getNodeRange(doc, path!);
      expect(range).toBeDefined();
      const text = doc.toString().slice(range!.from, range!.to);
      expect(text).toContain('Active Users');
      expect(text).not.toContain('Total Revenue');
    });
  });
});

// --- getNodeRange ---

describe('getNodeRange', () => {
  describe('component ranges are precise', () => {
    it('first component range does not overlap second component', () => {
      const doc = PageDocument.parse(FLAT_PAGE);
      const r0 = getNodeRange(doc, ['pages', 0, 'components', 0]);
      const r1 = getNodeRange(doc, ['pages', 0, 'components', 1]);
      expect(r0).toBeDefined();
      expect(r1).toBeDefined();
      expect(r0!.to).toBeLessThanOrEqual(r1!.from);
    });

    it('component range includes its properties', () => {
      const doc = PageDocument.parse(FLAT_PAGE);
      const range = getNodeRange(doc, ['pages', 0, 'components', 0]);
      expect(range).toBeDefined();
      const text = doc.toString().slice(range!.from, range!.to);
      expect(text).toContain('type: title');
      expect(text).toContain('text: Hello');
    });

    it('component range does NOT include sibling components', () => {
      const doc = PageDocument.parse(FLAT_PAGE);
      const range = getNodeRange(doc, ['pages', 0, 'components', 0]);
      expect(range).toBeDefined();
      const text = doc.toString().slice(range!.from, range!.to);
      expect(text).not.toContain('bar-chart');
    });
  });

  describe('page and dataset ranges', () => {
    it('page range includes all components', () => {
      const doc = PageDocument.parse(FLAT_PAGE);
      const range = getNodeRange(doc, ['pages', 0]);
      expect(range).toBeDefined();
      const text = doc.toString().slice(range!.from, range!.to);
      expect(text).toContain('Overview');
      expect(text).toContain('bar-chart');
    });

    it('dataset range includes its fields but not the next dataset', () => {
      const doc = PageDocument.parse(WITH_DATASETS);
      const range = getNodeRange(doc, ['datasets', 0]);
      expect(range).toBeDefined();
      const text = doc.toString().slice(range!.from, range!.to);
      expect(text).toContain('sales_tx');
      expect(text).toContain('Sales Transactions');
      expect(text).not.toContain('analytics');
    });
  });

  describe('invalid paths', () => {
    it('returns null for non-existent path', () => {
      const doc = PageDocument.parse(FLAT_PAGE);
      expect(getNodeRange(doc, ['pages', 99])).toBeNull();
    });

    it('returns null for empty path', () => {
      const doc = PageDocument.parse(FLAT_PAGE);
      expect(getNodeRange(doc, [])).toBeNull();
    });
  });
});

// --- classifyPath ---

describe('classifyPath', () => {
  it('classifies page path', () => {
    expect(classifyPath(['pages', 0])).toBe('page');
    expect(classifyPath(['pages', 1])).toBe('page');
  });

  it('classifies component path', () => {
    expect(classifyPath(['pages', 0, 'components', 0])).toBe('component');
    expect(classifyPath(['pages', 0, 'items', 0, 'component'])).toBe('component');
  });

  it('classifies grid-item path', () => {
    expect(classifyPath(['pages', 0, 'items', 0])).toBe('grid-item');
    expect(classifyPath(['pages', 0, 'items', 2])).toBe('grid-item');
  });

  it('classifies component inside grid-item path', () => {
    expect(classifyPath(['pages', 0, 'items', 0, 'component'])).toBe('component');
    expect(classifyPath(['pages', 0, 'items', 0, 'properties'])).toBe('component');
  });

  it('classifies dataset path', () => {
    expect(classifyPath(['datasets', 0])).toBe('dataset');
  });

  it('classifies nav path', () => {
    expect(classifyPath(['navTree', 'root_items', 0])).toBe('nav-item');
    expect(classifyPath(['navTree', 'root_items', 0, 'children', 0])).toBe('nav-item');
  });

  it('returns undefined for property paths (should resolve to parent)', () => {
    expect(classifyPath(['pages', 0, 'components', 0, 'properties', 'text'])).toBe('component');
    expect(classifyPath(['pages', 0, 'items', 0, 'properties'])).toBe('component');
  });

  it('treats non-numeric page indices as page-level', () => {
    expect(classifyPath(['pages', 'unknownKey'])).toBe('page');
    expect(classifyPath(['pages', 'unknownKey', 'nested'])).toBe('page');
  });

  it('returns undefined for unrecognised paths', () => {
    expect(classifyPath([])).toBeUndefined();
    expect(classifyPath(['unknown'])).toBeUndefined();
  });
});

// --- getParentPath ---

describe('getParentPath', () => {
  it('grid-item → page', () => {
    expect(getParentPath(['pages', 0, 'items', 0]))
      .toEqual(['pages', 0]);
  });

  it('page → pages section', () => {
    expect(getParentPath(['pages', 0])).toEqual(['pages']);
  });

  it('pages section → null (root)', () => {
    expect(getParentPath(['pages'])).toBeNull();
  });

  it('flat component → page', () => {
    expect(getParentPath(['pages', 0, 'components', 0]))
      .toEqual(['pages', 0]);
  });

  it('dataset → datasets section', () => {
    expect(getParentPath(['datasets', 0])).toEqual(['datasets']);
  });

  it('datasets section → null', () => {
    expect(getParentPath(['datasets'])).toBeNull();
  });

  it('nav child → nav parent', () => {
    expect(getParentPath(['navTree', 'root_items', 0, 'children', 0]))
      .toEqual(['navTree', 'root_items', 0]);
  });

  it('nav root item → navTree section', () => {
    expect(getParentPath(['navTree', 'root_items', 0])).toEqual(['navTree']);
  });

  it('empty → null', () => {
    expect(getParentPath([])).toBeNull();
  });

  it('full chain: component → page → section → null', () => {
    let path: readonly (string | number)[] | null = ['pages', 0, 'components', 0];
    const chain: string[] = [classifyPath(path)!];
    while (path) {
      path = getParentPath(path);
      if (path) chain.push(classifyPath(path)!);
    }
    expect(chain).toEqual(['component', 'page', 'section']);
  });
});
