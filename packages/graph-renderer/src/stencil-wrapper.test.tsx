import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { html } from 'lit-html';
import type { GraphNode } from '@casehubio/graph-core';
import { registerGrammar, clearGrammarRegistry } from '@casehubio/graph-core';

vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position }: { type: string; position: string }) =>
    React.createElement('div', { 'data-handletype': type, 'data-handlepos': position }),
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

import { createStencilNodeComponent, type StencilRenderFn } from './stencil-wrapper.js';

function mountWithProps(
  Component: React.ComponentType<any>,
  props: Record<string, unknown>,
): { container: HTMLDivElement; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(Component, props));
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const defaultNodeProps = {
  id: 'n1',
  type: 'test',
  data: { label: 'Test Node' } as Record<string, unknown>,
  dragging: false,
  zIndex: 0,
  selectable: true,
  deletable: true,
  selected: false,
  draggable: true,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
};

describe('createStencilNodeComponent', () => {
  beforeEach(() => {
    clearGrammarRegistry();
  });

  afterEach(() => {
    clearGrammarRegistry();
  });

  it('returns a function', () => {
    const renderFn: StencilRenderFn = () => html`<div>test</div>`;
    const Component = createStencilNodeComponent(renderFn);
    expect(typeof Component).toBe('function');
  });

  it('renders Lit template into container', () => {
    const renderFn: StencilRenderFn = (node) =>
      html`<span class="label">${String(node.properties['label'] ?? '')}</span>`;
    const Component = createStencilNodeComponent(renderFn);
    const { container, unmount } = mountWithProps(Component, defaultNodeProps);
    expect(container.querySelector('.label')?.textContent).toBe('Test Node');
    unmount();
  });

  it('passes correct GraphNode to render function', () => {
    const receivedNodes: GraphNode[] = [];
    const renderFn: StencilRenderFn = (node) => {
      receivedNodes.push(node);
      return html`<div>ok</div>`;
    };
    const Component = createStencilNodeComponent(renderFn);
    const { unmount } = mountWithProps(Component, {
      ...defaultNodeProps,
      id: 'x1',
      type: 'worker',
      parentId: 'p1',
      data: { count: 42 },
    });
    expect(receivedNodes).toHaveLength(1);
    expect(receivedNodes[0]!.id).toBe('x1');
    expect(receivedNodes[0]!.type).toBe('worker');
    expect(receivedNodes[0]!.parentId).toBe('p1');
    expect(receivedNodes[0]!.properties).toEqual({ count: 42 });
    unmount();
  });

  it('updates template when data changes', () => {
    const renderFn: StencilRenderFn = (node) =>
      html`<span class="v">${String(node.properties['val'] ?? '')}</span>`;
    const Component = createStencilNodeComponent(renderFn);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(React.createElement(Component, { ...defaultNodeProps, data: { val: 'A' } }));
    });
    expect(container.querySelector('.v')?.textContent).toBe('A');

    act(() => {
      root.render(React.createElement(Component, { ...defaultNodeProps, data: { val: 'B' } }));
    });
    expect(container.querySelector('.v')?.textContent).toBe('B');

    act(() => root.unmount());
    container.remove();
  });

  it('shows both handles when no grammar registered', () => {
    const renderFn: StencilRenderFn = () => html`<div>node</div>`;
    const Component = createStencilNodeComponent(renderFn);
    const { container, unmount } = mountWithProps(Component, defaultNodeProps);
    const handles = Array.from(container.querySelectorAll('[data-handletype]'));
    expect(handles).toHaveLength(2);
    expect(handles[0]!.getAttribute('data-handletype')).toBe('target');
    expect(handles[1]!.getAttribute('data-handletype')).toBe('source');
    unmount();
  });

  it('suppresses target handle when inbound.max is 0', () => {
    registerGrammar({
      type: 'entry',
      connections: {
        inbound: { min: 0, max: 0, allowedFrom: [] },
        outbound: { min: 0, max: 5, allowedTo: [] },
      },
    });
    const renderFn: StencilRenderFn = () => html`<div>entry</div>`;
    const Component = createStencilNodeComponent(renderFn);
    const { container, unmount } = mountWithProps(Component, {
      ...defaultNodeProps,
      type: 'entry',
    });
    const handles = Array.from(container.querySelectorAll('[data-handletype]'));
    expect(handles).toHaveLength(1);
    expect(handles[0]!.getAttribute('data-handletype')).toBe('source');
    unmount();
  });

  it('suppresses source handle when outbound.max is 0', () => {
    registerGrammar({
      type: 'goal',
      connections: {
        inbound: { min: 0, max: 5, allowedFrom: [] },
        outbound: { min: 0, max: 0, allowedTo: [] },
      },
    });
    const renderFn: StencilRenderFn = () => html`<div>goal</div>`;
    const Component = createStencilNodeComponent(renderFn);
    const { container, unmount } = mountWithProps(Component, {
      ...defaultNodeProps,
      type: 'goal',
    });
    const handles = Array.from(container.querySelectorAll('[data-handletype]'));
    expect(handles).toHaveLength(1);
    expect(handles[0]!.getAttribute('data-handletype')).toBe('target');
    unmount();
  });

  it('catches render function errors via error boundary', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const renderFn: StencilRenderFn = () => {
      throw new Error('Stencil broke');
    };
    const Component = createStencilNodeComponent(renderFn);
    const { container, unmount } = mountWithProps(Component, defaultNodeProps);
    expect(container.textContent).toContain('Stencil broke');
    unmount();
    consoleSpy.mockRestore();
  });
});
