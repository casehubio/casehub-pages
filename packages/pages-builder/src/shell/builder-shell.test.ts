import { describe, it, expect, afterEach } from 'vitest';
import { PageDocument } from '@casehubio/pages-document';
import './builder-shell.js';
import type { PagesBuilderShell } from './builder-shell.js';

const MINIMAL_PAGE = `pages:
- name: Overview
  components:
  - type: title
    properties:
      text: Hello
`;

const ROWS_PAGE = `pages:
- name: Dashboard
  rows:
  - columns:
    - span: 6
      components:
      - type: bar-chart
        properties:
          subtype: column
    - span: 6
      components:
      - type: pie-chart
`;

describe('PagesBuilderShell', () => {
  let el: PagesBuilderShell;

  afterEach(() => {
    el?.remove();
  });

  it('creates document from yaml property', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = MINIMAL_PAGE;
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.document.getPages()).toHaveLength(1);
    expect(el.document.getPages()[0]!.name).toBe('Overview');
  });

  it('renders toolbar buttons', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = MINIMAL_PAGE;
    document.body.appendChild(el);
    await el.updateComplete;

    const buttons = el.shadowRoot!.querySelectorAll('.toolbar-btn');
    const labels = Array.from(buttons).map(b => b.textContent?.trim());
    expect(labels).toContain('+ Page');
    expect(labels).toContain('+ Dataset');
    expect(labels).toContain('Undo');
    expect(labels).toContain('Redo');

    const dockIcon = el.shadowRoot!.querySelector('.dock-icon');
    expect(dockIcon).toBeTruthy();
  });

  it('adds a page via toolbar button', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = MINIMAL_PAGE;
    document.body.appendChild(el);
    await el.updateComplete;

    const addPageBtn = Array.from(el.shadowRoot!.querySelectorAll('.toolbar-btn'))
      .find(b => b.textContent?.trim() === '+ Page') as HTMLElement;
    addPageBtn.click();
    await el.updateComplete;

    expect(el.document.getPages()).toHaveLength(2);
    expect(el.document.getPages()[1]!.name).toBe('New Page');
  });

  it('adds a dataset via toolbar button', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = MINIMAL_PAGE;
    document.body.appendChild(el);
    await el.updateComplete;

    const addDsBtn = Array.from(el.shadowRoot!.querySelectorAll('.toolbar-btn'))
      .find(b => b.textContent?.trim() === '+ Dataset') as HTMLElement;
    addDsBtn.click();
    await el.updateComplete;

    expect(el.document.getDatasets()).toHaveLength(1);
    expect(el.document.getDatasets()[0]!.uuid).toBe('new_dataset');
  });

  it('undo reverts last action', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = MINIMAL_PAGE;
    document.body.appendChild(el);
    await el.updateComplete;

    const addPageBtn = Array.from(el.shadowRoot!.querySelectorAll('.toolbar-btn'))
      .find(b => b.textContent?.trim() === '+ Page') as HTMLElement;
    addPageBtn.click();
    expect(el.document.getPages()).toHaveLength(2);
    await el.updateComplete;

    const undoBtn = Array.from(el.shadowRoot!.querySelectorAll('.toolbar-btn'))
      .find(b => b.textContent?.trim() === 'Undo') as HTMLElement;
    expect(undoBtn.disabled).toBe(false);
    undoBtn.click();
    expect(el.document.getPages()).toHaveLength(1);
  });

  it('renders outline tree', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = MINIMAL_PAGE;
    document.body.appendChild(el);
    await el.updateComplete;

    const tree = el.shadowRoot!.querySelector('pages-builder-tree');
    expect(tree).toBeTruthy();
  });

  it('uses dock-workbench for layout with source and preview in split mode', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = MINIMAL_PAGE;
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('pages-dock-workbench')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.editor-source')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.editor-visual')).toBeTruthy();
  });

  it('switches view modes via tabs', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = MINIMAL_PAGE;
    document.body.appendChild(el);
    await el.updateComplete;

    const tabs = el.shadowRoot!.querySelectorAll('.view-tab');
    (tabs[0] as HTMLElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.editor-source')!.classList.contains('hidden')).toBe(false);
    expect(el.shadowRoot!.querySelector('.editor-visual')!.classList.contains('hidden')).toBe(true);

    (tabs[2] as HTMLElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.editor-source')!.classList.contains('hidden')).toBe(true);
    expect(el.shadowRoot!.querySelector('.editor-visual')!.classList.contains('hidden')).toBe(false);
  });

  it('properties dock starts open', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = MINIMAL_PAGE;
    document.body.appendChild(el);
    await el.updateComplete;

    const sections = el.shadowRoot!.querySelectorAll('.dock-section');
    expect(sections.length).toBe(1);
    const header = sections[0]!.querySelector('.dock-section-header span');
    expect(header!.textContent).toBe('Properties');
  });

  it('shows both dock panels when both toggled open', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = MINIMAL_PAGE;
    document.body.appendChild(el);
    await el.updateComplete;

    const compIcon = el.shadowRoot!.querySelectorAll('.dock-icon')[1] as HTMLElement;
    compIcon.click();
    await el.updateComplete;

    const sections = el.shadowRoot!.querySelectorAll('.dock-section');
    expect(sections.length).toBe(2);
    const headers = Array.from(sections).map(s => s.querySelector('.dock-section-header span')!.textContent);
    expect(headers).toContain('Properties');
    expect(headers).toContain('Components');
  });

  it('toggles properties panel via dock icon', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = MINIMAL_PAGE;
    document.body.appendChild(el);
    await el.updateComplete;

    const propsIcon = el.shadowRoot!.querySelector('.dock-icon') as HTMLElement;
    propsIcon.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.dock-section')).toBeNull();

    propsIcon.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.dock-section')).toBeTruthy();
  });

  it('creates empty document when no yaml provided', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.document.getPages()).toHaveLength(0);
  });

  it('updates property source on node-select', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = MINIMAL_PAGE;
    document.body.appendChild(el);
    await el.updateComplete;

    const tree = el.shadowRoot!.querySelector('pages-builder-tree') as HTMLElement;
    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0, 'components', 0], nodeType: 'component' },
    }));
    await el.updateComplete;

    const propPalette = el.shadowRoot!.querySelector('pages-property-palette') as any;
    expect(propPalette).toBeTruthy();
    const emptyPanel = el.shadowRoot!.querySelector('.empty-panel');
    expect(emptyPanel).toBeNull();
  });

  it('property change updates data and YAML', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = MINIMAL_PAGE;
    document.body.appendChild(el);
    await el.updateComplete;

    const tree = el.shadowRoot!.querySelector('pages-builder-tree') as HTMLElement;
    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0, 'components', 0], nodeType: 'component' },
    }));
    await el.updateComplete;

    const propPalette = el.shadowRoot!.querySelector('pages-property-palette') as any;
    const source = propPalette.source;
    expect(source).toBeTruthy();

    source.onChange(['text'], 'Updated Title');
    await el.updateComplete;

    expect(el.document.toString()).toContain('Updated Title');
    const comp = el.document.getPages()[0]!.getComponents()[0]!;
    expect(comp.getProperties()['text']).toBe('Updated Title');
  });

  it('selecting enum value writes to YAML document', async () => {
    const yamlWithChart = `pages:\n- name: P\n  components:\n  - type: bar-chart\n`;
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = yamlWithChart;
    document.body.appendChild(el);
    await el.updateComplete;

    const tree = el.shadowRoot!.querySelector('pages-builder-tree') as HTMLElement;
    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0, 'components', 0], nodeType: 'component' },
    }));
    await el.updateComplete;

    const source = (el.shadowRoot!.querySelector('pages-property-palette') as any).source;
    expect(source.data['subtype']).toBeUndefined();

    source.onChange(['subtype'], 'column');
    await el.updateComplete;

    expect(el.document.toString()).toContain('subtype: column');
    const comp = el.document.getPages()[0]!.getComponents()[0]!;
    expect(comp.getProperties()['subtype']).toBe('column');
  });

  it('source.data reflects value after onChange (live, not stale)', async () => {
    const yamlWithChart = `pages:\n- name: P\n  components:\n  - type: bar-chart\n`;
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = yamlWithChart;
    document.body.appendChild(el);
    await el.updateComplete;

    const tree = el.shadowRoot!.querySelector('pages-builder-tree') as HTMLElement;
    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0, 'components', 0], nodeType: 'component' },
    }));
    await el.updateComplete;

    const source = (el.shadowRoot!.querySelector('pages-property-palette') as any).source;
    expect(source.data['subtype']).toBeUndefined();

    source.onChange(['subtype'], 'column');

    expect(source.data['subtype']).toBe('column');
    expect(el.document.toString()).toContain('subtype: column');
  });

  it('source.data reflects cleared value after onChange with blank', async () => {
    const yaml = `pages:\n- name: P\n  components:\n  - type: bar-chart\n    properties:\n      subtype: column\n`;
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = yaml;
    document.body.appendChild(el);
    await el.updateComplete;

    const tree = el.shadowRoot!.querySelector('pages-builder-tree') as HTMLElement;
    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0, 'components', 0], nodeType: 'component' },
    }));
    await el.updateComplete;

    const source = (el.shadowRoot!.querySelector('pages-property-palette') as any).source;
    expect(source.data['subtype']).toBe('column');

    source.onChange(['subtype'], '');

    expect(source.data['subtype']).toBeUndefined();
    expect(el.document.toString()).not.toContain('subtype');
  });

  it('clearing enum value removes property from YAML', async () => {
    const yamlWithSubtype = `pages:\n- name: P\n  components:\n  - type: bar-chart\n    properties:\n      subtype: column\n`;
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = yamlWithSubtype;
    document.body.appendChild(el);
    await el.updateComplete;

    const tree = el.shadowRoot!.querySelector('pages-builder-tree') as HTMLElement;
    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0, 'components', 0], nodeType: 'component' },
    }));
    await el.updateComplete;

    const source = (el.shadowRoot!.querySelector('pages-property-palette') as any).source;
    expect(source.data['subtype']).toBe('column');

    source.onChange(['subtype'], '');
    await el.updateComplete;

    expect(el.document.toString()).not.toContain('subtype');
    const comp = el.document.getPages()[0]!.getComponents()[0]!;
    expect(comp.getProperties()['subtype']).toBeUndefined();
  });

  it('re-selecting node after change shows updated data', async () => {
    const yamlWithChart = `pages:\n- name: P\n  components:\n  - type: bar-chart\n`;
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = yamlWithChart;
    document.body.appendChild(el);
    await el.updateComplete;

    const tree = el.shadowRoot!.querySelector('pages-builder-tree') as HTMLElement;
    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0, 'components', 0], nodeType: 'component' },
    }));
    await el.updateComplete;

    const source = (el.shadowRoot!.querySelector('pages-property-palette') as any).source;
    source.onChange(['subtype'], 'column');

    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0], nodeType: 'page' },
    }));
    await el.updateComplete;

    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0, 'components', 0], nodeType: 'component' },
    }));
    await el.updateComplete;

    const freshSource = (el.shadowRoot!.querySelector('pages-property-palette') as any).source;
    expect(freshSource.data['subtype']).toBe('column');
  });

  // --- Palette insertion and context ---

  async function openComponentsDock(shell: PagesBuilderShell): Promise<void> {
    const dockIcons = shell.shadowRoot!.querySelectorAll('.dock-icon');
    (dockIcons[1] as HTMLElement).click();
    await shell.updateComplete;
  }

  it('clicking palette tile inserts component into selected page', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = `pages:\n- name: P\n  components:\n  - type: title\n`;
    document.body.appendChild(el);
    await el.updateComplete;
    await openComponentsDock(el);

    const tree = el.shadowRoot!.querySelector('pages-builder-tree') as HTMLElement;
    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0], nodeType: 'page' },
    }));
    await el.updateComplete;

    const palette = el.shadowRoot!.querySelector('pages-builder-palette') as HTMLElement;
    palette.dispatchEvent(new CustomEvent('component-select', {
      bubbles: true, composed: true,
      detail: { type: 'metric', label: 'Metric', defaultProps: {} },
    }));
    await el.updateComplete;

    const comps = el.document.getPages()[0]!.getComponents();
    expect(comps).toHaveLength(2);
    expect(comps[1]!.type).toBe('metric');
  });

  it('clicking palette tile inserts component into selected column', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = `pages:\n- name: P\n  rows:\n  - columns:\n    - span: 12\n      components:\n      - type: title\n`;
    document.body.appendChild(el);
    await el.updateComplete;
    await openComponentsDock(el);

    const tree = el.shadowRoot!.querySelector('pages-builder-tree') as HTMLElement;
    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0, 'rows', 0, 'columns', 0], nodeType: 'column' },
    }));
    await el.updateComplete;

    const palette = el.shadowRoot!.querySelector('pages-builder-palette') as HTMLElement;
    palette.dispatchEvent(new CustomEvent('component-select', {
      bubbles: true, composed: true,
      detail: { type: 'bar-chart', label: 'Bar Chart', defaultProps: { subtype: 'column' } },
    }));
    await el.updateComplete;

    const col = el.document.getPages()[0]!.getRows()[0]!.getColumns()[0]!;
    expect(col.getComponents()).toHaveLength(2);
    expect(col.getComponents()[1]!.type).toBe('bar-chart');
  });

  it('clicking palette tile when component selected inserts as sibling', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = `pages:\n- name: P\n  components:\n  - type: title\n`;
    document.body.appendChild(el);
    await el.updateComplete;
    await openComponentsDock(el);

    const tree = el.shadowRoot!.querySelector('pages-builder-tree') as HTMLElement;
    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0, 'components', 0], nodeType: 'component' },
    }));
    await el.updateComplete;

    const palette = el.shadowRoot!.querySelector('pages-builder-palette') as HTMLElement;
    palette.dispatchEvent(new CustomEvent('component-select', {
      bubbles: true, composed: true,
      detail: { type: 'metric', label: 'Metric', defaultProps: {} },
    }));
    await el.updateComplete;

    const comps = el.document.getPages()[0]!.getComponents();
    expect(comps).toHaveLength(2);
    expect(comps[1]!.type).toBe('metric');
  });

  it('inserting component updates YAML text in editor', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = `pages:\n- name: P\n  components:\n  - type: title\n`;
    document.body.appendChild(el);
    await el.updateComplete;
    await openComponentsDock(el);

    const tree = el.shadowRoot!.querySelector('pages-builder-tree') as HTMLElement;
    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0], nodeType: 'page' },
    }));
    await el.updateComplete;

    const palette = el.shadowRoot!.querySelector('pages-builder-palette') as HTMLElement;
    palette.dispatchEvent(new CustomEvent('component-select', {
      bubbles: true, composed: true,
      detail: { type: 'metric', label: 'Metric', defaultProps: {} },
    }));
    await el.updateComplete;

    const codeEditor = el.shadowRoot!.querySelector('pages-code-editor') as any;
    expect(codeEditor).toBeTruthy();
    const editorValue = codeEditor.value ?? '';
    expect(editorValue).toContain('metric');
  });

  it('inserting component updates tree and document model', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = `pages:\n- name: P\n  components:\n  - type: title\n`;
    document.body.appendChild(el);
    await el.updateComplete;
    await openComponentsDock(el);

    const tree = el.shadowRoot!.querySelector('pages-builder-tree') as HTMLElement;
    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0], nodeType: 'page' },
    }));
    await el.updateComplete;

    const before = el.document.getPages()[0]!.getComponents().length;

    const palette = el.shadowRoot!.querySelector('pages-builder-palette') as HTMLElement;
    palette.dispatchEvent(new CustomEvent('component-select', {
      bubbles: true, composed: true,
      detail: { type: 'metric', label: 'Metric', defaultProps: {} },
    }));
    await el.updateComplete;

    const after = el.document.getPages()[0]!.getComponents().length;
    expect(after).toBe(before + 1);

    const yaml = el.document.toString();
    expect(yaml).toContain('type: metric');
    expect(yaml).toContain('type: title');
  });

  it('consecutive palette insertions all sync to YAML editor', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = `pages:\n- name: P\n  components:\n  - type: title\n`;
    document.body.appendChild(el);
    await el.updateComplete;
    await openComponentsDock(el);

    const tree = el.shadowRoot!.querySelector('pages-builder-tree') as HTMLElement;
    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0], nodeType: 'page' },
    }));
    await el.updateComplete;

    const palette = el.shadowRoot!.querySelector('pages-builder-palette') as HTMLElement;

    palette.dispatchEvent(new CustomEvent('component-select', {
      bubbles: true, composed: true,
      detail: { type: 'rows', label: 'Rows', defaultProps: {} },
    }));
    await el.updateComplete;

    const yaml1 = el.document.toString();
    expect(yaml1).toContain('type: rows');
    const editor1 = (el.shadowRoot!.querySelector('pages-code-editor') as any)?.value ?? '';
    expect(editor1, 'first insertion should appear in editor').toContain('type: rows');

    palette.dispatchEvent(new CustomEvent('component-select', {
      bubbles: true, composed: true,
      detail: { type: 'rows', label: 'Rows', defaultProps: {} },
    }));
    await el.updateComplete;

    const yaml2 = el.document.toString();
    const rowCount = (yaml2.match(/type: rows/g) || []).length;
    expect(rowCount, 'document should have 2 rows').toBe(2);

    const editor2 = (el.shadowRoot!.querySelector('pages-code-editor') as any)?.value ?? '';
    const editorRowCount = (editor2.match(/type: rows/g) || []).length;
    expect(editorRowCount, 'editor should also have 2 rows').toBe(2);

    palette.dispatchEvent(new CustomEvent('component-select', {
      bubbles: true, composed: true,
      detail: { type: 'metric', label: 'Metric', defaultProps: {} },
    }));
    await el.updateComplete;

    const yaml3 = el.document.toString();
    expect(yaml3).toContain('type: metric');
    const editor3 = (el.shadowRoot!.querySelector('pages-code-editor') as any)?.value ?? '';
    expect(editor3, 'third insertion should appear in editor').toContain('type: metric');
    expect(editor3).toBe(yaml3);
  });

  it('palette context refreshes when selection changes', async () => {
    el = document.createElement('pages-builder-shell') as PagesBuilderShell;
    el.yaml = `pages:\n- name: P\n  components:\n  - type: title\ndatasets:\n- uuid: ds1\n`;
    document.body.appendChild(el);
    await el.updateComplete;

    const dockIcons = el.shadowRoot!.querySelectorAll('.dock-icon');
    (dockIcons[1] as HTMLElement).click();
    await el.updateComplete;

    const palette1 = el.shadowRoot!.querySelector('pages-builder-palette') as any;
    expect(palette1.context).toBeDefined();
    expect(palette1.context.availableDatasets).toContain('ds1');

    el.document.addDataset('ds2');
    await el.updateComplete;

    const tree = el.shadowRoot!.querySelector('pages-builder-tree') as HTMLElement;
    tree.dispatchEvent(new CustomEvent('node-select', {
      bubbles: true, composed: true,
      detail: { path: ['pages', 0, 'components', 0], nodeType: 'component' },
    }));
    await el.updateComplete;

    const palette2 = el.shadowRoot!.querySelector('pages-builder-palette') as any;
    expect(palette2.context.availableDatasets).toContain('ds2');
  });
});
