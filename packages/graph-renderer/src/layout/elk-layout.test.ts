import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { computeElkLayout } from './elk-layout.js';

describe('computeElkLayout', () => {
  const nodes: Node[] = [
    { id: '1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
    { id: '2', position: { x: 0, y: 0 }, data: { label: 'Node 2' } },
    { id: '3', position: { x: 0, y: 0 }, data: { label: 'Node 3' } },
  ];

  const edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e1-3', source: '1', target: '3' },
  ];

  it('assigns non-zero positions to nodes', async () => {
    const result = await computeElkLayout(nodes, edges);
    const nonZeroPositions = result.filter(
      n => n.position.x !== 0 || n.position.y !== 0,
    );
    expect(nonZeroPositions.length).toBeGreaterThan(0);
  });

  it('does not overlap nodes', async () => {
    const result = await computeElkLayout(nodes, edges);
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i]!;
        const b = result[j]!;
        const overlaps =
          Math.abs(a.position.x - b.position.x) < 10 &&
          Math.abs(a.position.y - b.position.y) < 10;
        expect(overlaps, `nodes ${a.id} and ${b.id} overlap`).toBe(false);
      }
    }
  });

  it('handles containment groups', async () => {
    const groupNodes: Node[] = [
      { id: 'parent', position: { x: 0, y: 0 }, data: { label: 'Parent' }, style: { width: 200, height: 200 } },
      { id: 'child1', position: { x: 0, y: 0 }, data: { label: 'Child 1' }, parentId: 'parent' },
      { id: 'child2', position: { x: 0, y: 0 }, data: { label: 'Child 2' }, parentId: 'parent' },
    ];
    const groupEdges: Edge[] = [
      { id: 'ec1-c2', source: 'child1', target: 'child2' },
    ];

    const result = await computeElkLayout(groupNodes, groupEdges);
    expect(result).toHaveLength(3);
    const parent = result.find(n => n.id === 'parent');
    expect(parent).toBeDefined();
  });
});
