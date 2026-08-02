import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@casehubio/pages-ui-tokens', () => ({
  applyTheme: vi.fn(),
  getTheme: vi.fn(() => ''),
  listThemes: vi.fn(() => ['default-light', 'default-dark']),
  registerTheme: vi.fn(),
}));

import './GraphCanvas.js';

describe('GraphCanvas', () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement('pages-graph-canvas');
  });

  afterEach(() => {
    element.remove();
    document.head.querySelectorAll('style[data-graph-isolation]')
      .forEach(el => el.remove());
  });

  it('registers as a custom element', () => {
    expect(customElements.get('pages-graph-canvas')).toBeDefined();
  });

  it('creates a .diagram-root container on connect', () => {
    document.body.appendChild(element);
    const container = element.querySelector('.diagram-root');
    expect(container).not.toBeNull();
  });

  it('removes container on disconnect', () => {
    document.body.appendChild(element);
    expect(element.querySelector('.diagram-root')).not.toBeNull();
    element.remove();
    expect(element.querySelector('.diagram-root')).toBeNull();
  });

  it('calls applyTheme on the container', async () => {
    const { applyTheme } = await import('@casehubio/pages-ui-tokens');
    document.body.appendChild(element);
    const container = element.querySelector('.diagram-root');
    expect(applyTheme).toHaveBeenCalledWith('default-light', container);
  });

  it('uses createRenderRoot to skip Shadow DOM', () => {
    expect(element.shadowRoot).toBeNull();
  });
});
