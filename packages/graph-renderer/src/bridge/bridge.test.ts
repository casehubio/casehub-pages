import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { GraphModel } from '@casehubio/graph-core';

vi.mock('@casehubio/pages-ui-tokens', () => ({
  applyTheme: vi.fn(),
  getTheme: vi.fn(() => ''),
  listThemes: vi.fn(() => ['default-light', 'default-dark']),
  registerTheme: vi.fn(),
}));

vi.mock('../layout/elk-layout.js', () => ({
  computeElkLayout: vi.fn(async (nodes: unknown[]) => nodes),
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

  it('accepts model property', () => {
    const model: GraphModel = {
      nodes: [{ id: 'n1', type: 'test', properties: {} }],
      edges: [],
    };
    (element as any).model = model;
    expect((element as any).model).toBe(model);
  });

  it('accepts layoutOptions property', () => {
    const opts = { direction: 'RIGHT' as const, spacing: 30 };
    (element as any).layoutOptions = opts;
    expect((element as any).layoutOptions).toBe(opts);
  });
});
