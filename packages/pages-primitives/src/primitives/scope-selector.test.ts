import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import './scope-selector.js';
import type { PagesScopeSelector, ScopeItem } from './scope-selector.js';

function items(): ScopeItem[] {
  return [
    { id: 'all', label: 'All', count: 10 },
    { id: 'active', label: 'Active', count: 7 },
    { id: 'closed', label: 'Closed', count: 3, badge: 'new' },
  ];
}

describe('PagesScopeSelector', () => {
  let el: PagesScopeSelector;

  beforeEach(async () => {
    el = document.createElement('pages-scope-selector') as PagesScopeSelector;
    el.items = items();
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => el.remove());

  // ---------- rendering ----------

  it('renders a pill for each item', () => {
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    expect(pills.length).toBe(3);
  });

  it('renders label and count', () => {
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    expect(pills[0]!.textContent).toContain('All');
    expect(pills[0]!.textContent).toContain('(10)');
  });

  it('renders badge when provided', () => {
    const badge = el.shadowRoot!.querySelector('.scope-badge');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain('new');
  });

  it('has role=radiogroup on the container', () => {
    const group = el.shadowRoot!.querySelector('[role="radiogroup"]');
    expect(group).not.toBeNull();
  });

  // ---------- selection ----------

  it('click selects a pill', async () => {
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    (pills[1] as HTMLElement).click();
    await el.updateComplete;
    expect(el.selected).toBe('active');
    expect(pills[1]!.getAttribute('aria-checked')).toBe('true');
  });

  it('radio behaviour: selecting one deselects previous', async () => {
    el.selected = 'all';
    await el.updateComplete;
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    (pills[1] as HTMLElement).click();
    await el.updateComplete;
    expect(el.selected).toBe('active');
    expect(pills[0]!.getAttribute('aria-checked')).toBe('false');
    expect(pills[1]!.getAttribute('aria-checked')).toBe('true');
  });

  it('pre-set selected is rendered as checked', async () => {
    el.selected = 'active';
    await el.updateComplete;
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    expect(pills[1]!.getAttribute('aria-checked')).toBe('true');
    expect(pills[0]!.getAttribute('aria-checked')).toBe('false');
  });

  // ---------- allowDeselect ----------

  it('clicking active pill does NOT deselect when allowDeselect=false', async () => {
    el.selected = 'all';
    await el.updateComplete;
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    (pills[0] as HTMLElement).click();
    await el.updateComplete;
    expect(el.selected).toBe('all');
  });

  it('clicking active pill deselects when allowDeselect=true', async () => {
    el.allowDeselect = true;
    el.selected = 'all';
    await el.updateComplete;
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    (pills[0] as HTMLElement).click();
    await el.updateComplete;
    expect(el.selected).toBeNull();
  });

  // ---------- events ----------

  it('emits pages-scope-change on selection', async () => {
    let detail: { selected: string | null } | undefined;
    el.addEventListener('pages-scope-change', ((e: CustomEvent) => {
      detail = e.detail as { selected: string | null };
    }) as EventListener);
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    (pills[0] as HTMLElement).click();
    expect(detail).toBeDefined();
    expect(detail!.selected).toBe('all');
  });

  it('emits pages-scope-change with null on deselect', async () => {
    el.allowDeselect = true;
    el.selected = 'all';
    await el.updateComplete;
    let detail: { selected: string | null } | undefined;
    el.addEventListener('pages-scope-change', ((e: CustomEvent) => {
      detail = e.detail as { selected: string | null };
    }) as EventListener);
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    (pills[0] as HTMLElement).click();
    expect(detail).toBeDefined();
    expect(detail!.selected).toBeNull();
  });

  it('event bubbles and is composed', async () => {
    let event: CustomEvent | undefined;
    document.body.addEventListener('pages-scope-change', ((e: CustomEvent) => {
      event = e;
    }) as EventListener);
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    (pills[0] as HTMLElement).click();
    expect(event).toBeDefined();
    expect(event!.bubbles).toBe(true);
    expect(event!.composed).toBe(true);
    document.body.removeEventListener('pages-scope-change', (() => {}) as EventListener);
  });

  // ---------- keyboard navigation ----------

  it('ArrowRight navigates to next pill', () => {
    el.rovingIndex = 0;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(el.rovingIndex).toBe(1);
  });

  it('ArrowLeft navigates to previous pill', () => {
    el.rovingIndex = 1;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(el.rovingIndex).toBe(0);
  });

  // ---------- empty state ----------

  it('renders nothing with empty items', async () => {
    el.items = [];
    await el.updateComplete;
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    expect(pills.length).toBe(0);
  });
});
