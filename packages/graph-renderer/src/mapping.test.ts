import { describe, it, expect } from 'vitest';
import { toReactFlowNode, toReactFlowEdge, toReactFlowGraph } from './mapping.js';
import type { GraphNode, GraphEdge, GraphModel } from '@casehubio/graph-core';
import type { NodeLayout, ElkLayoutResult } from './layout/elk-layout.js';

describe('toReactFlowNode', () => {
  const parentIds = new Set<string>();

  it('maps id, type, and parentId directly', () => {
    const node: GraphNode = {
      id: 'n1', type: 'binding', parentId: 'w1',
      properties: { label: 'test' },
    };
    const result = toReactFlowNode(node, parentIds);
    expect(result.id).toBe('n1');
    expect(result.type).toBe('binding');
    expect(result.parentId).toBe('w1');
  });

  it('maps properties to data', () => {
    const node: GraphNode = {
      id: 'n1', type: 'binding',
      properties: { label: 'test', count: 42 },
    };
    const result = toReactFlowNode(node, parentIds);
    expect(result.data).toEqual({ label: 'test', count: 42 });
  });

  it('sets position to {0, 0}', () => {
    const node: GraphNode = {
      id: 'n1', type: 'binding', properties: {},
    };
    const result = toReactFlowNode(node, parentIds);
    expect(result.position).toEqual({ x: 0, y: 0 });
  });

  it('sets default dimensions on parent nodes', () => {
    const parents = new Set(['w1']);
    const node: GraphNode = {
      id: 'w1', type: 'worker', properties: {},
    };
    const result = toReactFlowNode(node, parents);
    expect(result.style).toEqual(
      expect.objectContaining({ width: 280, height: 180 }),
    );
  });

  it('does not set dimensions on non-parent nodes', () => {
    const node: GraphNode = {
      id: 'n1', type: 'binding', properties: {},
    };
    const result = toReactFlowNode(node, parentIds);
    expect(result.style).toBeUndefined();
  });

  it('omits parentId when not present', () => {
    const node: GraphNode = {
      id: 'n1', type: 'binding', properties: {},
    };
    const result = toReactFlowNode(node, parentIds);
    expect(result.parentId).toBeUndefined();
  });
});

describe('toReactFlowEdge', () => {
  it('maps id, source, target directly', () => {
    const edge: GraphEdge = {
      id: 'e1', type: 'default', source: 'n1', target: 'n2',
    };
    const result = toReactFlowEdge(edge);
    expect(result.id).toBe('e1');
    expect(result.source).toBe('n1');
    expect(result.target).toBe('n2');
  });

  it('maps type directly', () => {
    const edge: GraphEdge = {
      id: 'e1', type: 'capability', source: 'n1', target: 'n2',
    };
    const result = toReactFlowEdge(edge);
    expect(result.type).toBe('capability');
  });

  it('maps properties to data when present', () => {
    const edge: GraphEdge = {
      id: 'e1', type: 'default', source: 'n1', target: 'n2',
      properties: { weight: 5 },
    };
    const result = toReactFlowEdge(edge);
    expect(result.data).toEqual({ weight: 5 });
  });

  it('sets data to undefined when properties absent', () => {
    const edge: GraphEdge = {
      id: 'e1', type: 'default', source: 'n1', target: 'n2',
    };
    const result = toReactFlowEdge(edge);
    expect(result.data).toBeUndefined();
  });
});

describe('toReactFlowGraph', () => {
  it('converts a full model', () => {
    const model: GraphModel = {
      nodes: [
        { id: 'w1', type: 'worker', properties: { label: 'Worker' } },
        { id: 'b1', type: 'binding', parentId: 'w1', properties: { label: 'Binding' } },
      ],
      edges: [
        { id: 'e1', type: 'default', source: 'b1', target: 'w1' },
      ],
    };
    const result = toReactFlowGraph(model);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    const w1 = result.nodes.find(n => n.id === 'w1');
    expect(w1?.style).toEqual(expect.objectContaining({ width: 280 }));
    const b1 = result.nodes.find(n => n.id === 'b1');
    expect(b1?.style).toBeUndefined();
  });

  it('returns empty arrays for empty model', () => {
    const model: GraphModel = { nodes: [], edges: [] };
    const result = toReactFlowGraph(model);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });
});

describe('toReactFlowNode with layout', () => {
  it('applies position from NodeLayout', () => {
    const node: GraphNode = { id: 'n1', type: 'a', properties: {} };
    const layout: NodeLayout = { x: 100, y: 200, width: 172, height: 36 };
    const result = toReactFlowNode(node, new Set(), layout);
    expect(result.position).toEqual({ x: 100, y: 200 });
  });

  it('applies width/height to parent nodes from NodeLayout', () => {
    const node: GraphNode = { id: 'p1', type: 'group', properties: {} };
    const layout: NodeLayout = { x: 50, y: 60, width: 400, height: 300 };
    const result = toReactFlowNode(node, new Set(['p1']), layout);
    expect(result.style).toEqual(expect.objectContaining({ width: 400, height: 300 }));
  });

  it('does not apply width/height to non-parent nodes', () => {
    const node: GraphNode = { id: 'n1', type: 'a', properties: {} };
    const layout: NodeLayout = { x: 10, y: 20, width: 172, height: 36 };
    const result = toReactFlowNode(node, new Set(), layout);
    expect(result.style).toBeUndefined();
  });
});

describe('toReactFlowGraph with layout', () => {
  it('applies layout positions and container sizes', () => {
    const model: GraphModel = {
      nodes: [
        { id: 'w1', type: 'group', properties: {} },
        { id: 'b1', type: 'a', parentId: 'w1', properties: {} },
      ],
      edges: [],
    };
    const layout: ElkLayoutResult = {
      nodeLayouts: new Map([
        ['w1', { x: 0, y: 0, width: 400, height: 300 }],
        ['b1', { x: 20, y: 20, width: 172, height: 36 }],
      ]),
    };
    const result = toReactFlowGraph(model, layout);
    const w1 = result.nodes.find(n => n.id === 'w1')!;
    const b1 = result.nodes.find(n => n.id === 'b1')!;
    expect(w1.position).toEqual({ x: 0, y: 0 });
    expect(w1.style).toEqual(expect.objectContaining({ width: 400, height: 300 }));
    expect(b1.position).toEqual({ x: 20, y: 20 });
    expect(b1.style).toBeUndefined();
  });

  it('falls back to defaults when layout is absent', () => {
    const model: GraphModel = {
      nodes: [
        { id: 'w1', type: 'group', properties: {} },
        { id: 'b1', type: 'a', parentId: 'w1', properties: {} },
      ],
      edges: [],
    };
    const result = toReactFlowGraph(model);
    const w1 = result.nodes.find(n => n.id === 'w1')!;
    const b1 = result.nodes.find(n => n.id === 'b1')!;
    expect(b1.position).toEqual({ x: 0, y: 0 });
    expect(w1.style).toEqual(expect.objectContaining({ width: 280, height: 180 }));
  });

  it('falls back to {0,0} for nodes missing from layout map', () => {
    const model: GraphModel = {
      nodes: [{ id: 'n1', type: 'a', properties: {} }],
      edges: [],
    };
    const layout: ElkLayoutResult = { nodeLayouts: new Map() };
    const result = toReactFlowGraph(model, layout);
    expect(result.nodes[0]!.position).toEqual({ x: 0, y: 0 });
  });
});
