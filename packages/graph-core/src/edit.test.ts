import { describe, it, expect, beforeEach } from 'vitest';
import { addNode, removeNode, replaceNode } from './edit.js';
import { createGraph } from './graph.js';
import { registerGrammar, clearGrammarRegistry } from './grammar.js';
import type { GraphModel, GraphNode, GraphEdge } from './model.js';

function node(id: string, type: string, parentId?: string): GraphNode {
  const base = { id, type, properties: {} };
  return parentId !== undefined ? { ...base, parentId } : base;
}

function edge(id: string, source: string, target: string, type = 'default'): GraphEdge {
  return { id, type, source, target };
}

describe('addNode', () => {
  beforeEach(() => {
    clearGrammarRegistry();
  });

  it('adds a node to an empty graph', () => {
    const model = createGraph([], []);
    const result = addNode(model, node('a', 'binding'));
    expect(result.model.nodes).toHaveLength(1);
    expect(result.model.nodes[0]!.id).toBe('a');
  });

  it('adds a node to an existing graph', () => {
    const model = createGraph([node('a', 'binding')], []);
    const result = addNode(model, node('b', 'worker'));
    expect(result.model.nodes).toHaveLength(2);
  });

  it('adds a node with containment', () => {
    const model = createGraph([node('w1', 'worker')], []);
    const result = addNode(model, node('c1', 'capability', 'w1'));
    expect(result.model.nodes).toHaveLength(2);
    expect(result.model.nodes[1]!.parentId).toBe('w1');
  });

  it('produces a new model instance', () => {
    const model = createGraph([node('a', 'binding')], []);
    const result = addNode(model, node('b', 'worker'));
    expect(result.model).not.toBe(model);
    expect(model.nodes).toHaveLength(1);
  });

  it('preserves existing edges', () => {
    const model = createGraph(
      [node('a', 'binding'), node('b', 'worker')],
      [edge('e1', 'a', 'b')],
    );
    const result = addNode(model, node('c', 'worker'));
    expect(result.model.edges).toHaveLength(1);
  });

  it('reports constraint violations without blocking', () => {
    registerGrammar({
      type: 'capability',
      connections: {
        inbound: { min: 0, max: 0, allowedFrom: [] },
        outbound: { min: 0, max: 0, allowedTo: [] },
      },
      containment: { allowedParentTypes: ['worker'] },
    });
    const model = createGraph([node('b1', 'binding')], []);
    const result = addNode(model, node('c1', 'capability', 'b1'));
    expect(result.model.nodes).toHaveLength(2);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('throws on duplicate node ID', () => {
    const model = createGraph([node('a', 'binding')], []);
    expect(() => addNode(model, node('a', 'worker'))).toThrow(/duplicate/i);
  });
});

describe('removeNode', () => {
  beforeEach(() => {
    clearGrammarRegistry();
  });

  it('removes a node from the graph', () => {
    const model = createGraph(
      [node('a', 'binding'), node('b', 'worker')],
      [],
    );
    const result = removeNode(model, 'a');
    expect(result.model.nodes).toHaveLength(1);
    expect(result.model.nodes[0]!.id).toBe('b');
  });

  it('removes associated edges', () => {
    const model = createGraph(
      [node('a', 'binding'), node('b', 'worker'), node('c', 'worker')],
      [edge('e1', 'a', 'b'), edge('e2', 'a', 'c'), edge('e3', 'b', 'c')],
    );
    const result = removeNode(model, 'a');
    expect(result.model.edges).toHaveLength(1);
    expect(result.model.edges[0]!.id).toBe('e3');
  });

  it('produces a new model instance', () => {
    const model = createGraph([node('a', 'binding'), node('b', 'worker')], []);
    const result = removeNode(model, 'a');
    expect(result.model).not.toBe(model);
    expect(model.nodes).toHaveLength(2);
  });

  it('removes children when parent is removed', () => {
    const model = createGraph(
      [node('w1', 'worker'), node('c1', 'cap', 'w1'), node('c2', 'cap', 'w1')],
      [],
    );
    const result = removeNode(model, 'w1');
    expect(result.model.nodes).toHaveLength(0);
  });

  it('throws when node does not exist', () => {
    const model = createGraph([node('a', 'binding')], []);
    expect(() => removeNode(model, 'missing')).toThrow(/not found/i);
  });
});

describe('replaceNode', () => {
  beforeEach(() => {
    clearGrammarRegistry();
  });

  it('replaces a node preserving its ID', () => {
    const model = createGraph([node('a', 'binding')], []);
    const replacement = node('a', 'worker');
    const result = replaceNode(model, 'a', replacement);
    expect(result.model.nodes).toHaveLength(1);
    expect(result.model.nodes[0]!.type).toBe('worker');
  });

  it('preserves edges connected to the node', () => {
    const model = createGraph(
      [node('a', 'binding'), node('b', 'worker')],
      [edge('e1', 'a', 'b')],
    );
    const replacement = node('a', 'goal');
    const result = replaceNode(model, 'a', replacement);
    expect(result.model.edges).toHaveLength(1);
  });

  it('produces a new model instance', () => {
    const model = createGraph([node('a', 'binding')], []);
    const result = replaceNode(model, 'a', node('a', 'worker'));
    expect(result.model).not.toBe(model);
  });

  it('reports violations when replacement breaks grammar rules', () => {
    registerGrammar({
      type: 'goal',
      connections: {
        inbound: { min: 0, max: 0, allowedFrom: [] },
        outbound: { min: 0, max: 0, allowedTo: [] },
      },
    });
    registerGrammar({
      type: 'binding',
      connections: {
        inbound: { min: 0, max: 0, allowedFrom: [] },
        outbound: { min: 0, max: 1, allowedTo: ['worker'] },
      },
    });
    const model = createGraph(
      [node('a', 'binding'), node('b', 'worker')],
      [edge('e1', 'a', 'b')],
    );
    const result = replaceNode(model, 'a', node('a', 'goal'));
    expect(result.model.nodes[0]!.type).toBe('goal');
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('throws when target node does not exist', () => {
    const model = createGraph([node('a', 'binding')], []);
    expect(() => replaceNode(model, 'missing', node('missing', 'worker'))).toThrow(/not found/i);
  });

  it('throws when replacement ID does not match target', () => {
    const model = createGraph([node('a', 'binding')], []);
    expect(() => replaceNode(model, 'a', node('b', 'worker'))).toThrow(/must match/i);
  });
});
