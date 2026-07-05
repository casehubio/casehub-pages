import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import './filter-chips.js';
import type { PagesFilterChips, ChipItem } from './filter-chips.js';

function items(): ChipItem[] {
  return [
    { id: 'a', label: 'Alpha', count: 5 },
    { id: 'b', label: 'Beta', count: 3 },
    { id: 'c', label: 'Gamma', count: 0 },
  ];
}

describe('PagesFilterChips', () => {
  let el: PagesFilterChips;

  beforeEach(async () => {
    el = document.createElement('pages-filter-chips') as PagesFilterChips;
    el.items = items();
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => el.remove());

  // ---------- rendering ----------

  it('renders a chip for each item', () => {
    const chips = el.shadowRoot!.querySelectorAll('[role="option"]');
    expect(chips.length).toBe(3);
  });

  it('renders label and count text', () => {
    const chips = el.shadowRoot!.querySelectorAll('[role="option"]');
    expect(chips[0]!.textContent).toContain('Alpha');
    expect(chips[0]!.textContent).toContain('(5)');
    expect(chips[1]!.textContent).toContain('Beta');
    expect(chips[1]!.textContent).toContain('(3)');
  });

  it('renders count=0 chips as disabled', () => {
    const chips = el.shadowRoot!.querySelectorAll('[role="option"]');
    const zeroChip = chips[2]!;
    expect(zeroChip.getAttribute('aria-disabled')).toBe('true');
  });

  it('count=0 chips are not selectable', () => {
    const chips = el.shadowRoot!.querySelectorAll('[role="option"]');
    (chips[2] as HTMLElement).click();
    expect(el.selected).toEqual([]);
  });

  // ---------- selection ----------

  it('click toggles selection on', async () => {
    const chips = el.shadowRoot!.querySelectorAll('[role="option"]');
    (chips[0] as HTMLElement).click();
    await el.updateComplete;
    expect(el.selected).toContain('a');
    expect(chips[0]!.getAttribute('aria-selected')).toBe('true');
  });

  it('click toggles selection off', async () => {
    el.selected = ['a'];
    await el.updateComplete;
    const chips = el.shadowRoot!.querySelectorAll('[role="option"]');
    (chips[0] as HTMLElement).click();
    await el.updateComplete;
    expect(el.selected).not.toContain('a');
    expect(chips[0]!.getAttribute('aria-selected')).toBe('false');
  });

  it('supports multi-select', async () => {
    const chips = el.shadowRoot!.querySelectorAll('[role="option"]');
    (chips[0] as HTMLElement).click();
    await el.updateComplete;
    (chips[1] as HTMLElement).click();
    await el.updateComplete;
    expect(el.selected).toEqual(['a', 'b']);
  });

  it('pre-set selected items are rendered as selected', async () => {
    el.selected = ['b'];
    await el.updateComplete;
    const chips = el.shadowRoot!.querySelectorAll('[role="option"]');
    expect(chips[1]!.getAttribute('aria-selected')).toBe('true');
    expect(chips[0]!.getAttribute('aria-selected')).toBe('false');
  });

  // ---------- events ----------

  it('emits pages-filter-chips-change on toggle', async () => {
    let detail: { selected: string[] } | undefined;
    el.addEventListener('pages-filter-chips-change', ((e: CustomEvent) => {
      detail = e.detail as { selected: string[] };
    }) as EventListener);
    const chips = el.shadowRoot!.querySelectorAll('[role="option"]');
    (chips[0] as HTMLElement).click();
    expect(detail).toBeDefined();
    expect(detail!.selected).toContain('a');
  });

  it('event bubbles and is composed', async () => {
    let event: CustomEvent | undefined;
    document.body.addEventListener('pages-filter-chips-change', ((e: CustomEvent) => {
      event = e;
    }) as EventListener);
    const chips = el.shadowRoot!.querySelectorAll('[role="option"]');
    (chips[0] as HTMLElement).click();
    expect(event).toBeDefined();
    expect(event!.bubbles).toBe(true);
    expect(event!.composed).toBe(true);
    document.body.removeEventListener('pages-filter-chips-change', (() => {}) as EventListener);
  });

  // ---------- disabled state ----------

  it('disabled attribute prevents all clicks', async () => {
    el.disabled = true;
    await el.updateComplete;
    const chips = el.shadowRoot!.querySelectorAll('[role="option"]');
    (chips[0] as HTMLElement).click();
    expect(el.selected).toEqual([]);
  });

  // ---------- keyboard navigation ----------

  it('ArrowRight navigates to next chip', () => {
    el.rovingIndex = 0;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(el.rovingIndex).toBe(1);
  });

  it('ArrowLeft navigates to previous chip', () => {
    el.rovingIndex = 1;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(el.rovingIndex).toBe(0);
  });

  it('has role=listbox on the container', () => {
    const listbox = el.shadowRoot!.querySelector('[role="listbox"]');
    expect(listbox).not.toBeNull();
  });

  // ---------- empty state ----------

  it('renders nothing with empty items', async () => {
    el.items = [];
    await el.updateComplete;
    const chips = el.shadowRoot!.querySelectorAll('[role="option"]');
    expect(chips.length).toBe(0);
  });
});
