import { describe, it, expect, vi, afterEach } from 'vitest';
import './inline-picker.js';
import type { PagesBuilderInlinePicker } from './inline-picker.js';
import type { PaletteContext } from '../catalog/palette-context.js';

const CTX: PaletteContext = {
  parentType: undefined,
  acceptsComponents: true,
  availableDatasets: ['ds1'],
  siblingTypes: [],
};

function createPicker(ctx?: Partial<PaletteContext>): PagesBuilderInlinePicker {
  const el = document.createElement('pages-builder-inline-picker') as PagesBuilderInlinePicker;
  el.context = { ...CTX, ...ctx };
  return el;
}

describe('PagesBuilderInlinePicker', () => {
  let el: PagesBuilderInlinePicker;

  afterEach(() => {
    el?.remove();
  });

  it('renders nothing when closed', async () => {
    el = createPicker();
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.picker-popover')).toBeNull();
  });

  it('renders picker when open', async () => {
    el = createPicker();
    el.open = true;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.picker-popover')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.picker-search')).toBeTruthy();
  });

  it('renders component items from catalog', async () => {
    el = createPicker();
    el.open = true;
    document.body.appendChild(el);
    await el.updateComplete;
    const items = el.shadowRoot!.querySelectorAll('.picker-item');
    expect(items.length).toBeGreaterThan(0);
  });

  it('fires component-select on item click', async () => {
    el = createPicker();
    el.open = true;
    document.body.appendChild(el);
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('component-select', ((e: CustomEvent) => events.push(e)) as EventListener);

    const item = el.shadowRoot!.querySelector<HTMLButtonElement>('.picker-item');
    item?.click();

    expect(events).toHaveLength(1);
    expect(events[0]!.detail.type).toBeDefined();
  });

  it('closes and fires picker-close on Escape', async () => {
    el = createPicker();
    el.open = true;
    document.body.appendChild(el);
    await el.updateComplete;

    const events: Event[] = [];
    el.addEventListener('picker-close', (e) => events.push(e));

    const popover = el.shadowRoot!.querySelector('.picker-popover')!;
    popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(el.open).toBe(false);
    expect(events).toHaveLength(1);
  });

  it('filters items by search', async () => {
    el = createPicker();
    el.open = true;
    document.body.appendChild(el);
    await el.updateComplete;

    const allItems = el.shadowRoot!.querySelectorAll('.picker-item').length;

    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.picker-search')!;
    input.value = 'bar-chart';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await el.updateComplete;

    const filteredItems = el.shadowRoot!.querySelectorAll('.picker-item').length;
    expect(filteredItems).toBeLessThan(allItems);
    expect(filteredItems).toBeGreaterThan(0);
  });

  it('closes after selecting a component', async () => {
    el = createPicker();
    el.open = true;
    document.body.appendChild(el);
    await el.updateComplete;

    const item = el.shadowRoot!.querySelector<HTMLButtonElement>('.picker-item');
    item?.click();

    expect(el.open).toBe(false);
  });
});
