import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import './pages-dock-workbench.js';
import type { PagesDockWorkbench } from './pages-dock-workbench.js';

function createDock(attrs?: Partial<PagesDockWorkbench>): PagesDockWorkbench {
  const el = document.createElement('pages-dock-workbench') as PagesDockWorkbench;
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      (el as any)[key] = value;
    }
  }
  return el;
}

describe('PagesDockWorkbench', () => {
  let el: PagesDockWorkbench;

  afterEach(() => {
    el?.remove();
  });

  it('renders slots for all zones', async () => {
    el = createDock({ leftCollapsed: false, rightCollapsed: false, bottomCollapsed: false });
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('slot[name="left"]')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('slot[name="centre"]')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('slot[name="right"]')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('slot[name="bottom"]')).toBeTruthy();
  });

  it('hides left zone when leftEnabled=false', async () => {
    el = createDock({ leftEnabled: false });
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('slot[name="left"]')).toBeNull();
  });

  it('hides right zone when rightEnabled=false', async () => {
    el = createDock({ rightEnabled: false });
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('slot[name="right"]')).toBeNull();
  });

  it('hides bottom zone when bottomEnabled=false', async () => {
    el = createDock({ bottomEnabled: false });
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('slot[name="bottom"]')).toBeNull();
  });

  it('hides left slot when collapsed', async () => {
    el = createDock({ leftCollapsed: true });
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('slot[name="left"]')).toBeNull();
  });

  it('always renders centre slot', async () => {
    el = createDock({ leftEnabled: false, rightEnabled: false, bottomEnabled: false });
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('slot[name="centre"]')).toBeTruthy();
  });

  it('fires dock-panel-toggle on toggleZone', async () => {
    el = createDock();
    document.body.appendChild(el);
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('dock-panel-toggle', ((e: CustomEvent) => events.push(e)) as EventListener);

    el.toggleZone('left');
    expect(events).toHaveLength(1);
    expect(events[0]!.detail.zone).toBe('left');
    expect(events[0]!.detail.collapsed).toBe(true);
  });

  it('toggle bar buttons toggle zones', async () => {
    el = createDock({ showToggleBar: true, leftCollapsed: false });
    document.body.appendChild(el);
    await el.updateComplete;

    const toggleBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="Toggle left panel"]');
    expect(toggleBtn).toBeTruthy();
    toggleBtn!.click();
    expect(el.leftCollapsed).toBe(true);
  });

  it('hides toggle bar when showToggleBar=false', async () => {
    el = createDock({ showToggleBar: false });
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.toggle-bar')).toBeNull();
  });

  it('has correct ARIA roles', async () => {
    el = createDock({ leftCollapsed: false, rightCollapsed: false, bottomCollapsed: false });
    document.body.appendChild(el);
    await el.updateComplete;

    const regions = el.shadowRoot!.querySelectorAll('[role="region"]');
    expect(regions.length).toBeGreaterThanOrEqual(3);

    const separators = el.shadowRoot!.querySelectorAll('[role="separator"]');
    expect(separators.length).toBeGreaterThan(0);
  });

  it('renders status-bar slot', async () => {
    el = createDock();
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('slot[name="status-bar"]')).toBeTruthy();
  });
});
