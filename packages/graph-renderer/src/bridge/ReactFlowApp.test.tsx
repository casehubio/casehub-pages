import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

let capturedMiniMapProps: Record<string, unknown> = {};

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'react-flow' }, children),
  MiniMap: (props: Record<string, unknown>) => {
    capturedMiniMapProps = props;
    return React.createElement('div', { 'data-testid': 'minimap' });
  },
  Controls: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'controls' }, children),
  ControlButton: () => React.createElement('button'),
  Background: () => React.createElement('div', { 'data-testid': 'background' }),
  SelectionMode: { Partial: 'partial' },
}));

import { ReactFlowApp } from './ReactFlowApp.js';

describe('ReactFlowApp', () => {
  it('passes nodeColor to MiniMap for visible node fills', () => {
    capturedMiniMapProps = {};
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(ReactFlowApp, {
          nodes: [],
          edges: [],
          nodeTypes: {},
        }),
      );
    });

    expect(typeof capturedMiniMapProps['nodeColor']).toBe('function');
    const colorFn = capturedMiniMapProps['nodeColor'] as (node: { type?: string }) => string;
    expect(colorFn({ type: 'start' })).toBe('#16a34a');
    expect(colorFn({ type: 'try-catch' })).toBe('#c2410c');
    expect(colorFn({ type: 'call' })).toBe('#2563eb');
    expect(capturedMiniMapProps['maskColor']).toBe('rgba(0, 0, 0, 0.3)');

    act(() => root.unmount());
    container.remove();
  });
});
