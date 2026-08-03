import { describe, it, expect } from 'vitest';
import { toReactFlowNode, toReactFlowEdge, toReactFlowGraph } from './mapping.js';
import type { GraphNode, GraphEdge, GraphModel } from '@casehubio/graph-core';

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
