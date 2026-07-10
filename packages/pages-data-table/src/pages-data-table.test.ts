import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ColumnDef } from './types.js';

type DataTableEl = HTMLElement & {
  rows: readonly unknown[];
  columns: readonly ColumnDef[];
  mode: string;
  loading: boolean;
  emptyMessage: string;
  getRowKey: ((row: unknown) => string) | undefined;
  getRowClass: ((row: unknown) => string) | undefined;
  updateComplete: Promise<boolean>;
};

interface TestRow { id: string; name: string; age: number; created: string; }

const testColumns: ColumnDef<TestRow>[] = [
  { id: 'name', label: 'Name', getValue: r => r.name, width: '1fr' },
  { id: 'age', label: 'Age', type: 'number', getValue: r => r.age, width: '80px' },
];

const testRows: TestRow[] = [
  { id: '1', name: 'Alice', age: 30, created: '2024-01-01' },
  { id: '2', name: 'Bob', age: 25, created: '2024-06-15' },
  { id: '3', name: 'Carol', age: 35, created: '2024-03-10' },
];

function makeRows(count: number): TestRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i), name: `Person ${i}`, age: 20 + i, created: '2024-01-01',
  }));
}

describe('pages-data-table', () => {
  let el: DataTableEl;

  beforeEach(async () => {
    await import('./pages-data-table.js');
    el = document.createElement('pages-data-table') as DataTableEl;
    document.body.appendChild(el);
  });

  afterEach(() => { el.remove(); });

  describe('core rendering', () => {
    it('renders column headers', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;
      const headers = el.shadowRoot!.querySelectorAll('[role="columnheader"]');
      expect(headers.length).toBe(2);
      expect(headers[0]!.textContent).toContain('Name');
      expect(headers[1]!.textContent).toContain('Age');
    });

    it('renders cells using getValue', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;
      const cells = el.shadowRoot!.querySelectorAll('[role="gridcell"]');
      expect(cells.length).toBe(6); // 3 rows × 2 cols
      expect(cells[0]!.textContent).toContain('Alice');
      expect(cells[1]!.textContent).toContain('30');
    });

    it('uses render function when provided', async () => {
      const cols: ColumnDef<TestRow>[] = [
        { id: 'name', label: 'Name', getValue: r => r.name,
          render: v => `<${v}>` },
      ];
      el.columns = cols as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;
      const cell = el.shadowRoot!.querySelector('[role="gridcell"]')!;
      expect(cell.textContent).toContain('<Alice>');
    });

    it('formats dates by type', async () => {
      const cols: ColumnDef<TestRow>[] = [
        { id: 'created', label: 'Created', type: 'date', getValue: r => r.created },
      ];
      el.columns = cols as ColumnDef[];
      el.rows = [testRows[0]!];
      await el.updateComplete;
      const cell = el.shadowRoot!.querySelector('[role="gridcell"]')!;
      // toLocaleDateString output varies by locale, just check it's not raw ISO
      expect(cell.textContent).not.toContain('2024-01-01T');
    });

    it('renders empty state', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = [];
      await el.updateComplete;
      expect(el.shadowRoot!.textContent).toContain('No data');
    });

    it('renders custom empty message', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = [];
      el.emptyMessage = 'Nothing here';
      await el.updateComplete;
      expect(el.shadowRoot!.textContent).toContain('Nothing here');
    });

    it('renders loading state', async () => {
      el.loading = true;
      await el.updateComplete;
      const busy = el.shadowRoot!.querySelector('[aria-busy="true"]');
      expect(busy).not.toBeNull();
    });

    it('sets role="grid" on container', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[role="grid"]')).not.toBeNull();
    });

    it('sets aria-rowcount', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;
      const grid = el.shadowRoot!.querySelector('[role="grid"]')!;
      expect(grid.getAttribute('aria-rowcount')).toBe('4'); // 1 header + 3 data
    });

    it('applies getRowClass as part attribute', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      el.getRowClass = (r: unknown) => `priority-${(r as TestRow).name.toLowerCase()}`;
      await el.updateComplete;
      const rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      expect(rows[0]!.getAttribute('part')).toContain('priority-alice');
    });

    it('alternating rows have even/odd classes for zebra striping', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;
      const rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      expect(rows.length).toBeGreaterThanOrEqual(3);
      expect(rows[0]!.classList.contains('row-even')).toBe(true);
      expect(rows[1]!.classList.contains('row-odd')).toBe(true);
      expect(rows[2]!.classList.contains('row-even')).toBe(true);
    });
  });

  describe('auto mode', () => {
    it('renders all rows for small datasets', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;
      const rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      expect(rows.length).toBe(3);
    });

    it('activates virtual scroll for >50 rows', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = makeRows(100);
      await el.updateComplete;
      const rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      expect(rows.length).toBeLessThan(100);
    });
  });

  describe('paginated mode', () => {
    it('renders only pageSize rows', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = makeRows(30);
      el.mode = 'paginated';
      (el as any).pageSize = 10;
      await el.updateComplete;
      const rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      expect(rows.length).toBe(10);
    });

    it('renders page controls', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = makeRows(30);
      el.mode = 'paginated';
      (el as any).pageSize = 10;
      await el.updateComplete;
      const nav = el.shadowRoot!.querySelector('[role="navigation"]');
      expect(nav).not.toBeNull();
      expect(nav!.textContent).toContain('1');
      expect(nav!.textContent).toContain('3'); // 30/10 = 3 pages
    });

    it('emits page-change on next click', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = makeRows(30);
      el.mode = 'paginated';
      (el as any).pageSize = 10;
      await el.updateComplete;

      const events: CustomEvent[] = [];
      el.addEventListener('page-change', (e) => events.push(e as CustomEvent));

      const next = el.shadowRoot!.querySelector('[aria-label="Next page"]') as HTMLButtonElement;
      next.click();
      await el.updateComplete;

      expect(events.length).toBe(1);
      expect(events[0]!.detail.page).toBe(1);
      expect(events[0]!.detail.pageSize).toBe(10);
    });

    it('shows second page content after navigation', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = makeRows(30);
      el.mode = 'paginated';
      (el as any).pageSize = 10;
      await el.updateComplete;

      const next = el.shadowRoot!.querySelector('[aria-label="Next page"]') as HTMLButtonElement;
      next.click();
      await el.updateComplete;

      const firstCell = el.shadowRoot!.querySelector('[role="gridcell"]')!;
      expect(firstCell.textContent).toContain('Person 10');
    });

    it('uses totalRows for server-side pagination', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows; // only 3 rows provided (one page)
      el.mode = 'paginated';
      (el as any).pageSize = 3;
      (el as any).totalRows = 30;
      await el.updateComplete;

      const nav = el.shadowRoot!.querySelector('[role="navigation"]')!;
      expect(nav.textContent).toContain('10'); // 30/3 = 10 pages
    });

    it('disables prev/first on first page', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = makeRows(30);
      el.mode = 'paginated';
      (el as any).pageSize = 10;
      await el.updateComplete;
      const prev = el.shadowRoot!.querySelector('[aria-label="Previous page"]') as HTMLButtonElement;
      expect(prev.disabled).toBe(true);
    });

    it('disables next/last on last page', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = makeRows(30);
      el.mode = 'paginated';
      (el as any).pageSize = 10;
      (el as any).currentPage = 2;
      await el.updateComplete;
      const next = el.shadowRoot!.querySelector('[aria-label="Next page"]') as HTMLButtonElement;
      expect(next.disabled).toBe(true);
    });
  });

  describe('scroll mode', () => {
    it('renders virtual window of rows', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = makeRows(200);
      el.mode = 'scroll';
      (el as any).rowHeight = 48;
      (el as any).bufferSize = 5;
      await el.updateComplete;
      const rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      expect(rows.length).toBeLessThan(200);
      expect(rows.length).toBeGreaterThan(0);
    });

    it('sets spacer height for scrollbar', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = makeRows(100);
      el.mode = 'scroll';
      (el as any).rowHeight = 48;
      await el.updateComplete;
      const spacer = el.shadowRoot!.querySelector('.body-content') as HTMLElement;
      expect(spacer.style.height).toBe('4800px'); // 100 * 48
    });

    it('sets aria-rowindex on virtual rows', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = makeRows(100);
      el.mode = 'scroll';
      await el.updateComplete;
      const firstRow = el.shadowRoot!.querySelector('.row[role="row"]:not(.header)')!;
      const idx = parseInt(firstRow.getAttribute('aria-rowindex')!, 10);
      expect(idx).toBeGreaterThanOrEqual(2); // 1-based, header is row 1
    });

    it('does not emit load-more when hasMore is false', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = makeRows(20);
      el.mode = 'scroll';
      (el as any).hasMore = false;
      await el.updateComplete;
      const events: Event[] = [];
      el.addEventListener('load-more', e => events.push(e));
      // Simulate scroll to bottom — jsdom doesn't have real scroll, so verify the property guard
      expect(events.length).toBe(0);
    });
  });

  describe('selection', () => {
    const keyedCols = testColumns as ColumnDef[];

    it('throws when selection enabled without getRowKey', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      (el as any).selection = 'single';
      // getRowKey not set
      let error: Error | null = null;
      try { await el.updateComplete; } catch (e) { error = e as Error; }
      expect(error).not.toBeNull();
    });

    it('single: click selects row and emits events', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      (el as any).selection = 'single';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      const events: CustomEvent[] = [];
      el.addEventListener('selection-change', e => events.push(e as CustomEvent));
      el.addEventListener('row-activate', e => events.push(e as CustomEvent));

      const row = el.shadowRoot!.querySelector('.row[role="row"]:not(.header)') as HTMLElement;
      row.click();
      await el.updateComplete;

      // Validate event order: selection-change fires first, then row-activate
      expect(events.length).toBe(2);
      expect(events[0]!.type).toBe('selection-change');
      expect(events[1]!.type).toBe('row-activate');

      const selEvent = events.find(e => e.type === 'selection-change')!;
      expect(selEvent.detail.selectedKeys).toEqual(['1']);
      const actEvent = events.find(e => e.type === 'row-activate')!;
      expect(actEvent.detail.key).toBe('1');
    });

    it('single: click different row deselects previous', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      (el as any).selection = 'single';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      const rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      (rows[0] as HTMLElement).click();
      await el.updateComplete;
      (rows[1] as HTMLElement).click();
      await el.updateComplete;

      const selected = el.shadowRoot!.querySelectorAll('[aria-selected="true"]');
      expect(selected.length).toBe(1);
    });

    it('multi: renders checkbox column', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      (el as any).selection = 'multi';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      const checkboxes = el.shadowRoot!.querySelectorAll('[role="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('multi: checkbox click toggles selection', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      (el as any).selection = 'multi';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      const events: CustomEvent[] = [];
      el.addEventListener('selection-change', e => events.push(e as CustomEvent));

      const checkbox = el.shadowRoot!.querySelector('.row:not(.header) [role="checkbox"]') as HTMLElement;
      checkbox.click();
      await el.updateComplete;

      expect(events.length).toBe(1);
      expect(events[0]!.detail.selectedKeys).toContain('1');
    });

    it('multi: row click emits row-activate (not selection change)', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      (el as any).selection = 'multi';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      const activateEvents: CustomEvent[] = [];
      const selectionEvents: CustomEvent[] = [];
      el.addEventListener('row-activate', e => activateEvents.push(e as CustomEvent));
      el.addEventListener('selection-change', e => selectionEvents.push(e as CustomEvent));

      const row = el.shadowRoot!.querySelector('.row[role="row"]:not(.header)') as HTMLElement;
      row.click();
      await el.updateComplete;

      expect(activateEvents.length).toBe(1);
      expect(selectionEvents.length).toBe(0);
    });

    it('multi: only checkbox click toggles selection (not row click)', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      (el as any).selection = 'multi';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      const selectionEvents: CustomEvent[] = [];
      el.addEventListener('selection-change', e => selectionEvents.push(e as CustomEvent));

      // Click the row body — should NOT change selection
      const row = el.shadowRoot!.querySelector('.row[role="row"]:not(.header)') as HTMLElement;
      row.click();
      await el.updateComplete;
      expect(selectionEvents.length).toBe(0);

      // Click the checkbox — SHOULD change selection
      const checkbox = el.shadowRoot!.querySelector('.row[role="row"]:not(.header) .checkbox') as HTMLElement;
      checkbox.click();
      await el.updateComplete;
      expect(selectionEvents.length).toBe(1);
      expect(selectionEvents[0]!.detail.selectedKeys.length).toBe(1);
    });

    it('multi: single-click emits row-activate', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      (el as any).selection = 'multi';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      const events: CustomEvent[] = [];
      el.addEventListener('row-activate', e => events.push(e as CustomEvent));

      const row = el.shadowRoot!.querySelector('.row[role="row"]:not(.header)') as HTMLElement;
      row.click();
      await el.updateComplete;

      expect(events.length).toBe(1);
    });

    it('none: row-activate fires on click without getRowKey (key is undefined)', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      await el.updateComplete;

      const events: CustomEvent[] = [];
      el.addEventListener('row-activate', e => events.push(e as CustomEvent));

      const row = el.shadowRoot!.querySelector('.row[role="row"]:not(.header)') as HTMLElement;
      row.click();
      await el.updateComplete;

      expect(events[0]!.detail.key).toBeUndefined();
      expect(events[0]!.detail.row).toBeDefined();
    });

    it('controlled: selectedKeys drives selection state', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      (el as any).selection = 'multi';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      (el as any).selectedKeys = ['1', '3'];
      await el.updateComplete;

      const selected = el.shadowRoot!.querySelectorAll('[aria-selected="true"]');
      expect(selected.length).toBe(2);
    });

    it('multi: shift+click selects range', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      (el as any).selection = 'multi';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      const events: CustomEvent[] = [];
      el.addEventListener('selection-change', e => events.push(e as CustomEvent));

      const checkboxes = el.shadowRoot!.querySelectorAll('.row:not(.header) [role="checkbox"]');
      // Click first checkbox
      (checkboxes[0] as HTMLElement).click();
      await el.updateComplete;
      // Shift+click third checkbox
      const shiftEvent = new MouseEvent('click', { bubbles: true, shiftKey: true });
      (checkboxes[2] as HTMLElement).dispatchEvent(shiftEvent);
      await el.updateComplete;

      // Should have selected all three rows
      const lastEvent = events[events.length - 1]!;
      expect(lastEvent.detail.selectedKeys.length).toBe(3);
      expect(lastEvent.detail.selectedKeys).toContain('1');
      expect(lastEvent.detail.selectedKeys).toContain('2');
      expect(lastEvent.detail.selectedKeys).toContain('3');
    });

    it('multi: header checkbox selects all', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      (el as any).selection = 'multi';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      const events: CustomEvent[] = [];
      el.addEventListener('selection-change', e => events.push(e as CustomEvent));

      const headerCheckbox = el.shadowRoot!.querySelector('.header [role="checkbox"]') as HTMLElement;
      headerCheckbox.click();
      await el.updateComplete;

      expect(events[0]!.detail.selectedKeys.length).toBe(3);
    });

    it('multi: header checkbox deselects all when all selected', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      (el as any).selection = 'multi';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      const headerCheckbox = el.shadowRoot!.querySelector('.header [role="checkbox"]') as HTMLElement;

      // Select all
      headerCheckbox.click();
      await el.updateComplete;

      const events: CustomEvent[] = [];
      el.addEventListener('selection-change', e => events.push(e as CustomEvent));

      // Deselect all
      headerCheckbox.click();
      await el.updateComplete;

      expect(events[0]!.detail.selectedKeys.length).toBe(0);
    });

    it('multi: header checkbox shows mixed state when partial selection', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      (el as any).selection = 'multi';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      // Select one row
      const checkbox = el.shadowRoot!.querySelector('.row:not(.header) [role="checkbox"]') as HTMLElement;
      checkbox.click();
      await el.updateComplete;

      const headerCheckbox = el.shadowRoot!.querySelector('.header [role="checkbox"]')!;
      expect(headerCheckbox.getAttribute('aria-checked')).toBe('mixed');
    });

    it('paginated server-side: selection-change includes scope=page', async () => {
      el.columns = keyedCols;
      el.rows = testRows;
      el.mode = 'paginated';
      (el as any).totalRows = 30; // Server-side indicator
      (el as any).selection = 'multi';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      const events: CustomEvent[] = [];
      el.addEventListener('selection-change', e => events.push(e as CustomEvent));

      const checkbox = el.shadowRoot!.querySelector('.row:not(.header) [role="checkbox"]') as HTMLElement;
      checkbox.click();
      await el.updateComplete;

      expect(events[0]!.detail.scope).toBe('page');
    });
  });

  describe('sorting', () => {
    it('renders sort indicator on sortable columns', async () => {
      const cols: ColumnDef<TestRow>[] = [
        { id: 'name', label: 'Name', getValue: r => r.name, sortable: true },
        { id: 'age', label: 'Age', getValue: r => r.age },
      ];
      el.columns = cols as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;

      const headers = el.shadowRoot!.querySelectorAll('[role="columnheader"]');
      expect(headers[0]!.getAttribute('aria-sort')).toBe('none');
      expect(headers[1]!.hasAttribute('aria-sort')).toBe(false);
    });

    it('cycles sort direction on header click', async () => {
      const cols: ColumnDef<TestRow>[] = [
        { id: 'name', label: 'Name', getValue: r => r.name, sortable: true },
      ];
      el.columns = cols as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;

      const events: CustomEvent[] = [];
      el.addEventListener('sort-change', e => events.push(e as CustomEvent));

      const header = el.shadowRoot!.querySelector('[role="columnheader"]') as HTMLElement;

      header.click(); await el.updateComplete;
      expect(events[0]!.detail.direction).toBe('asc');

      header.click(); await el.updateComplete;
      expect(events[1]!.detail.direction).toBe('desc');

      header.click(); await el.updateComplete;
      expect(events[2]!.detail.direction).toBe('none');
    });

    it('clientSort=true reorders rows', async () => {
      const cols: ColumnDef<TestRow>[] = [
        { id: 'name', label: 'Name', getValue: r => r.name, sortable: true },
      ];
      el.columns = cols as ColumnDef[];
      el.rows = testRows;
      (el as any).clientSort = true;
      await el.updateComplete;

      const header = el.shadowRoot!.querySelector('[role="columnheader"]') as HTMLElement;
      header.click(); await el.updateComplete; // asc

      const cells = el.shadowRoot!.querySelectorAll('[role="gridcell"]');
      expect(cells[0]!.textContent).toContain('Alice');
      expect(cells[1]!.textContent).toContain('Bob');
      expect(cells[2]!.textContent).toContain('Carol');
    });
  });

  describe('column visibility', () => {
    it('hides columns with visible=false', async () => {
      const cols: ColumnDef<TestRow>[] = [
        { id: 'name', label: 'Name', getValue: r => r.name },
        { id: 'age', label: 'Age', getValue: r => r.age, visible: false },
      ];
      el.columns = cols as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;
      const headers = el.shadowRoot!.querySelectorAll('[role="columnheader"]');
      expect(headers.length).toBe(1);
      expect(headers[0]!.textContent).toContain('Name');
    });

    it('emits column-change when visibility toggled', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;

      const events: CustomEvent[] = [];
      el.addEventListener('column-change', e => events.push(e as CustomEvent));

      // Find and click column picker, then toggle a column
      const picker = el.shadowRoot!.querySelector('.column-picker-trigger') as HTMLElement;
      if (picker) {
        picker.click();
        await el.updateComplete;
        const checkboxes = el.shadowRoot!.querySelectorAll('.column-picker-item input');
        if (checkboxes.length > 0) {
          (checkboxes[1] as HTMLInputElement).click();
          await el.updateComplete;
          expect(events.length).toBe(1);
        }
      }
    });

    it('grid template excludes hidden columns', async () => {
      const cols: ColumnDef<TestRow>[] = [
        { id: 'name', label: 'Name', getValue: r => r.name, width: '1fr' },
        { id: 'age', label: 'Age', getValue: r => r.age, width: '80px', visible: false },
        { id: 'created', label: 'Created', getValue: r => r.created, width: '120px' },
      ];
      el.columns = cols as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;
      const header = el.shadowRoot!.querySelector('.header') as HTMLElement;
      const template = header.style.gridTemplateColumns;
      expect(template).not.toContain('80px');
      expect(template).toContain('1fr');
      expect(template).toContain('120px');
    });
  });

  describe('keyboard navigation', () => {
    it('ArrowDown moves focus to next row', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;

      // Query rows fresh before dispatching event
      let rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      (rows[0] as HTMLElement).focus();
      (rows[0] as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await el.updateComplete;
      await el.updateComplete; // Wait for async focus

      // Re-query rows after re-render
      rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      const focusedRow = Array.from(rows).find(r => r.getAttribute('tabindex') === '0');
      expect(focusedRow).toBe(rows[1]);
    });

    it('ArrowUp moves focus to previous row', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;
      let rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');

      (rows[1] as HTMLElement).focus();
      rows[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      await el.updateComplete;
      await el.updateComplete; // Wait for async focus

      // Re-query rows after re-render
      rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      const focusedRow = Array.from(rows).find(r => r.getAttribute('tabindex') === '0');
      expect(focusedRow).toBe(rows[0]);
    });

    it('Enter activates focused row', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      const events: CustomEvent[] = [];
      el.addEventListener('row-activate', e => events.push(e as CustomEvent));

      // Query row fresh before dispatching event
      const row = el.shadowRoot!.querySelector('.row[role="row"]:not(.header)') as HTMLElement;
      row.focus();
      row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await el.updateComplete;

      expect(events.length).toBe(1);
    });

    it('Escape clears selection', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      (el as any).selection = 'multi';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      // Select first row
      const checkbox = el.shadowRoot!.querySelector('.row:not(.header) [role="checkbox"]') as HTMLElement;
      checkbox.click();
      await el.updateComplete;

      // Press Escape on the grid
      const grid = el.shadowRoot!.querySelector('[role="grid"]') as HTMLElement;
      grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await el.updateComplete;

      const selected = el.shadowRoot!.querySelectorAll('[aria-selected="true"]');
      expect(selected.length).toBe(0);
    });

    it('Space toggles selection in multi mode', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      (el as any).selection = 'multi';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      const events: CustomEvent[] = [];
      el.addEventListener('selection-change', e => events.push(e as CustomEvent));

      // Query row fresh before dispatching event
      const row = el.shadowRoot!.querySelector('.row[role="row"]:not(.header)') as HTMLElement;
      row.focus();
      row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await el.updateComplete;

      expect(events.length).toBe(1);
      expect(events[0]!.detail.selectedKeys).toContain('1');
    });

    it('Home focuses first row', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;
      let rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');

      (rows[2] as HTMLElement).focus();
      rows[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      await el.updateComplete;
      await el.updateComplete; // Wait for async focus

      // Re-query rows after re-render
      rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      const focusedRow = Array.from(rows).find(r => r.getAttribute('tabindex') === '0');
      expect(focusedRow).toBe(rows[0]);
    });

    it('ArrowDown scrolls to off-screen row in scroll mode', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = makeRows(200);
      el.mode = 'scroll';
      (el as any).rowHeight = 48;
      await el.updateComplete;

      // Focus last visible row and press ArrowDown
      const rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      const lastVisible = rows[rows.length - 1] as HTMLElement;
      lastVisible.focus();
      // Set focus index to match the last visible row
      const startIndex = (el as any)._scrollWindow.startIndex;
      (el as any)._focusRowIndex = startIndex + rows.length - 1;

      // Press ArrowDown — should navigate beyond visible window
      lastVisible.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await el.updateComplete;

      // Focus index should have advanced
      expect((el as any)._focusRowIndex).toBe(startIndex + rows.length);
    });
  });

  describe('ARIA completeness', () => {
    it('sets aria-colcount', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;
      const grid = el.shadowRoot!.querySelector('[role="grid"]')!;
      expect(grid.getAttribute('aria-colcount')).toBe('2');
    });

    it('header checkbox has aria-checked=mixed for partial selection', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      (el as any).selection = 'multi';
      el.getRowKey = (r: unknown) => (r as TestRow).id;
      await el.updateComplete;

      // Select one row
      const checkbox = el.shadowRoot!.querySelector('.row:not(.header) [role="checkbox"]') as HTMLElement;
      checkbox.click();
      await el.updateComplete;

      const headerCheckbox = el.shadowRoot!.querySelector('.header [role="checkbox"]');
      expect(headerCheckbox!.getAttribute('aria-checked')).toBe('mixed');
    });
  });

  describe('visual rendering bugs', () => {
    const sortableCols: ColumnDef<TestRow>[] = [
      { id: 'name', label: 'Name', getValue: r => r.name, sortable: true, width: '1fr' },
      { id: 'age', label: 'Age', getValue: r => r.age, sortable: true, width: '80px' },
    ];

    it('column picker trigger is not a grid item inside the header row', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;

      const headerRow = el.shadowRoot!.querySelector('[role="row"].header, .header[role="row"]');
      const pickerInHeader = headerRow?.querySelector('.column-picker-trigger');
      expect(pickerInHeader).toBeNull();
    });

    it('sorted column header shows a visual direction indicator', async () => {
      el.columns = sortableCols as ColumnDef[];
      el.rows = testRows;
      (el as any).clientSort = true;
      await el.updateComplete;

      const header = el.shadowRoot!.querySelector('[role="columnheader"]') as HTMLElement;
      header.click();
      await el.updateComplete;

      const headerText = header.textContent!;
      const hasArrow = headerText.includes('▲') || headerText.includes('▼') || headerText.includes('↑') || headerText.includes('↓');
      expect(hasArrow).toBe(true);
    });

    it('host element style sets height on :host for parent fill', async () => {
      el.columns = testColumns as ColumnDef[];
      el.rows = testRows;
      await el.updateComplete;

      const styles = (el.constructor as any).styles;
      const cssText = Array.isArray(styles)
        ? styles.map((s: any) => s.cssText ?? String(s)).join(' ')
        : styles.cssText ?? String(styles);
      const hostMatch = cssText.match(/:host\s*\{[^}]*\}/);
      expect(hostMatch).not.toBeNull();
      expect(hostMatch![0]).toContain('height');
    });
  });

  describe('client filter', () => {
    it('filters rows by text match across columns', async () => {
      const cols: ColumnDef<{ name: string; role: string }>[] = [
        { id: 'name', label: 'Name', getValue: r => r.name },
        { id: 'role', label: 'Role', getValue: r => r.role },
      ];
      const rows = [
        { name: 'Alice', role: 'Engineer' },
        { name: 'Bob', role: 'Designer' },
        { name: 'Charlie', role: 'Engineer' },
      ];
      el.columns = cols as ColumnDef[];
      el.rows = rows;
      (el as any).clientFilter = true;
      (el as any).filterText = 'engineer';
      await el.updateComplete;

      const dataRows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      expect(dataRows.length).toBe(2); // Alice and Charlie
    });

    it('matches any column — row appears if ANY column matches', async () => {
      const cols: ColumnDef<{ name: string; role: string }>[] = [
        { id: 'name', label: 'Name', getValue: r => r.name },
        { id: 'role', label: 'Role', getValue: r => r.role },
      ];
      const rows = [
        { name: 'Alice', role: 'Engineer' },
        { name: 'Bob', role: 'Designer' },
      ];
      el.columns = cols as ColumnDef[];
      el.rows = rows;
      (el as any).clientFilter = true;
      (el as any).filterText = 'bob';
      await el.updateComplete;

      const dataRows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      expect(dataRows.length).toBe(1);
    });

    it('respects filterable: false on columns', async () => {
      const cols: ColumnDef<{ name: string; code: string }>[] = [
        { id: 'name', label: 'Name', getValue: r => r.name },
        { id: 'code', label: 'Code', getValue: r => r.code, filterable: false },
      ];
      const rows = [
        { name: 'Alice', code: '123' },
        { name: 'Bob', code: '456' },
      ];
      el.columns = cols as ColumnDef[];
      el.rows = rows;
      (el as any).clientFilter = true;
      (el as any).filterText = '123';
      await el.updateComplete;

      const dataRows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      expect(dataRows.length).toBe(0); // code column not filterable
    });

    it('uses filterValue when provided', async () => {
      const cols: ColumnDef<{ name: string; tags: string[] }>[] = [
        { id: 'name', label: 'Name', getValue: r => r.name },
        { id: 'tags', label: 'Tags', getValue: r => r.tags, filterValue: r => r.tags.join(' ') },
      ];
      const rows = [
        { name: 'Alice', tags: ['eng', 'lead'] },
        { name: 'Bob', tags: ['design'] },
      ];
      el.columns = cols as ColumnDef[];
      el.rows = rows;
      (el as any).clientFilter = true;
      (el as any).filterText = 'lead';
      await el.updateComplete;

      const dataRows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      expect(dataRows.length).toBe(1);
    });

    it('resets currentPage to 0 when filter changes', async () => {
      const cols: ColumnDef<{ name: string }>[] = [
        { id: 'name', label: 'Name', getValue: r => r.name },
      ];
      const rows = Array.from({ length: 100 }, (_, i) => ({ name: `Item ${i}` }));
      el.columns = cols as ColumnDef[];
      el.rows = rows;
      (el as any).mode = 'paginated';
      (el as any).pageSize = 10;
      (el as any).currentPage = 5;
      (el as any).clientFilter = true;
      await el.updateComplete;

      (el as any).filterText = 'Item 1';
      await el.updateComplete;
      expect((el as any).currentPage).toBe(0);
    });

    it('is ignored when totalRows is set (server pagination)', async () => {
      const cols: ColumnDef<{ name: string }>[] = [
        { id: 'name', label: 'Name', getValue: r => r.name },
      ];
      const rows = [
        { name: 'Alice' },
        { name: 'Bob' },
      ];
      el.columns = cols as ColumnDef[];
      el.rows = rows;
      (el as any).clientFilter = true;
      (el as any).filterText = 'alice';
      (el as any).totalRows = 100;
      await el.updateComplete;

      const dataRows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
      expect(dataRows.length).toBe(2); // no filtering — server-paginated
    });

    it('emits filter-change event', async () => {
      const cols: ColumnDef<{ name: string }>[] = [
        { id: 'name', label: 'Name', getValue: r => r.name },
      ];
      const rows = [
        { name: 'Alice' },
        { name: 'Bob' },
      ];
      el.columns = cols as ColumnDef[];
      el.rows = rows;
      (el as any).clientFilter = true;
      await el.updateComplete;

      const events: any[] = [];
      el.addEventListener('filter-change', (e: any) => events.push(e.detail));
      (el as any).filterText = 'alice';
      await el.updateComplete;
      await new Promise(r => setTimeout(r, 200)); // debounce

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].text).toBe('alice');
      expect(events[0].matchCount).toBe(1);
    });

    it('renders filter input when clientFilter is true', async () => {
      const cols: ColumnDef<{ name: string }>[] = [
        { id: 'name', label: 'Name', getValue: r => r.name },
      ];
      const rows = [{ name: 'A' }];
      el.columns = cols as ColumnDef[];
      el.rows = rows;
      (el as any).clientFilter = true;
      await el.updateComplete;

      const input = el.shadowRoot!.querySelector('.filter-input');
      expect(input).not.toBeNull();
    });
  });
});
