import { describe, it, expect } from 'vitest';
import { createGraph, type GraphModel } from '@casehubio/graph-core';
import { computeElkLayout } from './elk-layout.js';

const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 50;

describe('computeElkLayout', () => {
  it('assigns positions to flat graph nodes', async () => {
    const model = createGraph(
      [
        { id: '1', type: 'a', properties: { label: 'Node 1' } },
        { id: '2', type: 'a', properties: { label: 'Node 2' } },
        { id: '3', type: 'a', properties: { label: 'Node 3' } },
      ],
      [
        { id: 'e1-2', type: '', source: '1', target: '2' },
        { id: 'e1-3', type: '', source: '1', target: '3' },
      ],
    );
    const result = await computeElkLayout(model);
    expect(result.nodeLayouts.size).toBe(3);
    const nonZero = [...result.nodeLayouts.values()].filter(
      l => l.x !== 0 || l.y !== 0,
    );
    expect(nonZero.length).toBeGreaterThan(0);
  });

  it('does not overlap flat nodes', async () => {
    const model = createGraph(
      [
        { id: '1', type: 'a', properties: {} },
        { id: '2', type: 'a', properties: {} },
        { id: '3', type: 'a', properties: {} },
      ],
      [
        { id: 'e1-2', type: '', source: '1', target: '2' },
        { id: 'e1-3', type: '', source: '1', target: '3' },
      ],
    );
    const result = await computeElkLayout(model);
    const layouts = [...result.nodeLayouts.values()];
    for (let i = 0; i < layouts.length; i++) {
      for (let j = i + 1; j < layouts.length; j++) {
        const a = layouts[i]!;
        const b = layouts[j]!;
        const overlaps =
          Math.abs(a.x - b.x) < 10 && Math.abs(a.y - b.y) < 10;
        expect(overlaps, `nodes overlap at (${a.x},${a.y}) and (${b.x},${b.y})`).toBe(false);
      }
    }
  });

  it('returns empty map for empty model', async () => {
    const model = createGraph([], []);
    const result = await computeElkLayout(model);
    expect(result.nodeLayouts.size).toBe(0);
  });

  it('lays out nested graph with parent containing children', async () => {
    const model = createGraph(
      [
        { id: 'parent', type: 'group', properties: {} },
        { id: 'child1', type: 'a', parentId: 'parent', properties: {} },
        { id: 'child2', type: 'a', parentId: 'parent', properties: {} },
      ],
      [{ id: 'ec', type: '', source: 'child1', target: 'child2' }],
    );
    const result = await computeElkLayout(model);
    expect(result.nodeLayouts.size).toBe(3);
    const parent = result.nodeLayouts.get('parent')!;
    expect(parent.width).toBeGreaterThan(DEFAULT_NODE_WIDTH);
    expect(parent.height).toBeGreaterThan(DEFAULT_NODE_HEIGHT);
  });

  it('handles deep nesting (grandparent → parent → child)', async () => {
    const model = createGraph(
      [
        { id: 'gp', type: 'group', properties: {} },
        { id: 'p', type: 'group', parentId: 'gp', properties: {} },
        { id: 'c', type: 'a', parentId: 'p', properties: {} },
      ],
      [],
    );
    const result = await computeElkLayout(model);
    expect(result.nodeLayouts.size).toBe(3);
    const gp = result.nodeLayouts.get('gp')!;
    const p = result.nodeLayouts.get('p')!;
    expect(gp.width).toBeGreaterThan(p.width);
  });

  it('applies containerPadding option', async () => {
    const model = createGraph(
      [
        { id: 'p', type: 'group', properties: {} },
        { id: 'c', type: 'a', parentId: 'p', properties: {} },
      ],
      [],
    );
    const narrow = await computeElkLayout(model, { containerPadding: 5 });
    const wide = await computeElkLayout(model, { containerPadding: 50 });
    const narrowP = narrow.nodeLayouts.get('p')!;
    const wideP = wide.nodeLayouts.get('p')!;
    expect(wideP.width).toBeGreaterThan(narrowP.width);
  });

  it('applies direction option', async () => {
    const model = createGraph(
      [
        { id: '1', type: 'a', properties: {} },
        { id: '2', type: 'a', properties: {} },
      ],
      [{ id: 'e1', type: '', source: '1', target: '2' }],
    );
    const down = await computeElkLayout(model, { direction: 'DOWN' });
    const right = await computeElkLayout(model, { direction: 'RIGHT' });
    const downLayouts = [...down.nodeLayouts.values()];
    const rightLayouts = [...right.nodeLayouts.values()];
    const downYSpread = Math.abs(downLayouts[0]!.y - downLayouts[1]!.y);
    const rightXSpread = Math.abs(rightLayouts[0]!.x - rightLayouts[1]!.x);
    expect(downYSpread).toBeGreaterThan(0);
    expect(rightXSpread).toBeGreaterThan(0);
  });

  it('handles cross-hierarchy edges', async () => {
    const model = createGraph(
      [
        { id: 'p', type: 'group', properties: {} },
        { id: 'c', type: 'a', parentId: 'p', properties: {} },
        { id: 'ext', type: 'a', properties: {} },
      ],
      [{ id: 'e1', type: '', source: 'c', target: 'ext' }],
    );
    const result = await computeElkLayout(model);
    expect(result.nodeLayouts.size).toBe(3);
  });

  it('throws on containment cycle instead of stack overflow', async () => {
    const model: GraphModel = {
      nodes: [
        { id: 'a', type: 'x', parentId: 'b', properties: {} },
        { id: 'b', type: 'x', parentId: 'a', properties: {} },
      ],
      edges: [],
    };
    await expect(computeElkLayout(model)).rejects.toThrow('Containment cycle');
  });

  it('applies nodeSizes override to leaf node dimensions', async () => {
    const model = createGraph(
      [
        { id: '1', type: 'a', properties: {} },
        { id: '2', type: 'a', properties: {} },
      ],
      [{ id: 'e1', type: '', source: '1', target: '2' }],
    );
    const nodeSizes = new Map([['1', { width: 300, height: 200 }]]);
    const result = await computeElkLayout(model, { nodeSizes });
    const layout1 = result.nodeLayouts.get('1')!;
    expect(layout1.width).toBe(300);
    expect(layout1.height).toBe(200);
    const layout2 = result.nodeLayouts.get('2')!;
    expect(layout2.width).toBe(DEFAULT_NODE_WIDTH);
    expect(layout2.height).toBe(DEFAULT_NODE_HEIGHT);
  });

  it('ignores nodeSizes entries for node IDs not in the model', async () => {
    const model = createGraph(
      [
        { id: '1', type: 'a', properties: {} },
        { id: '2', type: 'a', properties: {} },
      ],
      [{ id: 'e1', type: '', source: '1', target: '2' }],
    );
    const nodeSizes = new Map([['nonexistent', { width: 500, height: 400 }]]);
    const result = await computeElkLayout(model, { nodeSizes });
    expect(result.nodeLayouts.size).toBe(2);
    for (const layout of result.nodeLayouts.values()) {
      expect(layout.width).toBe(DEFAULT_NODE_WIDTH);
      expect(layout.height).toBe(DEFAULT_NODE_HEIGHT);
    }
  });

  it('includes width and height in every NodeLayout', async () => {
    const model = createGraph(
      [
        { id: '1', type: 'a', properties: {} },
        { id: '2', type: 'a', properties: {} },
      ],
      [{ id: 'e1', type: '', source: '1', target: '2' }],
    );
    const result = await computeElkLayout(model);
    for (const layout of result.nodeLayouts.values()) {
      expect(layout.width).toBeGreaterThan(0);
      expect(layout.height).toBeGreaterThan(0);
    }
  });
});
