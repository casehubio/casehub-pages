import { describe, it, expect } from 'vitest';
import { createGraph } from '@casehubio/graph-core';
import { computeElkLayout } from './layout/elk-layout.js';
import { toReactFlowGraph } from './mapping.js';
import type { Node, Edge } from '@xyflow/react';

const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 50;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function nodeRect(node: Node): Rect {
  return {
    x: node.position.x,
    y: node.position.y,
    w: node.width ?? DEFAULT_NODE_WIDTH,
    h: node.height ?? DEFAULT_NODE_HEIGHT,
  };
}

function handleCenter(node: Node, type: 'source' | 'target'): { x: number; y: number } {
  const r = nodeRect(node);
  const data = node.data as Record<string, unknown>;
  const pos = type === 'source'
    ? (data._sourceHandlePosition as string | undefined) ?? 'bottom'
    : (data._targetHandlePosition as string | undefined) ?? 'top';

  switch (pos) {
    case 'top': return { x: r.x + r.w / 2, y: r.y };
    case 'bottom': return { x: r.x + r.w / 2, y: r.y + r.h };
    case 'left': return { x: r.x, y: r.y + r.h / 2 };
    case 'right': return { x: r.x + r.w, y: r.y + r.h / 2 };
    default: return { x: r.x + r.w / 2, y: r.y + r.h };
  }
}

function lineIntersectsRect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  rect: Rect,
  margin: number = 5,
): boolean {
  const r = { x: rect.x + margin, y: rect.y + margin, w: rect.w - 2 * margin, h: rect.h - 2 * margin };
  if (r.w <= 0 || r.h <= 0) return false;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  let tMin = 0;
  let tMax = 1;

  const edges = [
    { p: -dx, q: -(r.x - p1.x) },
    { p: dx, q: (r.x + r.w - p1.x) },
    { p: -dy, q: -(r.y - p1.y) },
    { p: dy, q: (r.y + r.h - p1.y) },
  ];

  for (const { p, q } of edges) {
    if (Math.abs(p) < 1e-10) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) {
        if (t > tMax) return false;
        if (t > tMin) tMin = t;
      } else {
        if (t < tMin) return false;
        if (t < tMax) tMax = t;
      }
    }
  }
  return tMin <= tMax;
}

function assertNoEdgeCrossings(nodes: Node[], edges: Edge[]): void {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const tolerance = 30;

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const p1 = handleCenter(sourceNode, 'source');
    const p2 = handleCenter(targetNode, 'target');
    const srcY = sourceNode.position.y;
    const tgtY = targetNode.position.y;

    for (const node of nodes) {
      if (node.id === edge.source || node.id === edge.target) continue;
      if (node.parentId) continue;

      // Skip same-layer siblings — bezier curves route around them
      const ny = node.position.y;
      if (Math.abs(ny - srcY) < tolerance || Math.abs(ny - tgtY) < tolerance) continue;

      const rect = nodeRect(node);
      const crosses = lineIntersectsRect(p1, p2, rect);
      expect(
        crosses,
        `Edge ${edge.source} → ${edge.target} crosses node '${node.id}' at (${rect.x},${rect.y},${rect.w},${rect.h})`,
      ).toBe(false);
    }
  }
}

describe('handle position auto-detection', () => {
  it('DOWN layout: source handles are bottom for vertical flow', async () => {
    const model = createGraph(
      [
        { id: 'a', type: 'call', properties: { label: 'A' } },
        { id: 'b', type: 'call', properties: { label: 'B' } },
      ],
      [{ id: 'e1', type: 'flow', source: 'a', target: 'b' }],
    );
    const layout = await computeElkLayout(model, { direction: 'DOWN' });
    const { nodes } = toReactFlowGraph(model, layout, undefined, 'DOWN');
    const a = nodes.find(n => n.id === 'a')!;
    expect((a.data as Record<string, unknown>)._sourceHandlePosition).toBe('bottom');
  });

  it('RIGHT layout: source handles are right for horizontal flow', async () => {
    const model = createGraph(
      [
        { id: 'a', type: 'call', properties: { label: 'A' } },
        { id: 'b', type: 'call', properties: { label: 'B' } },
      ],
      [{ id: 'e1', type: 'flow', source: 'a', target: 'b' }],
    );
    const layout = await computeElkLayout(model, { direction: 'RIGHT' });
    const { nodes } = toReactFlowGraph(model, layout, undefined, 'RIGHT');
    const a = nodes.find(n => n.id === 'a')!;
    expect((a.data as Record<string, unknown>)._sourceHandlePosition).toBe('right');
  });

  it('DOWN layout: fan-out switch keeps bottom source handle', async () => {
    // Debug: check actual positions
    const model = createGraph(
      [
        { id: 'switch', type: 'switch', properties: { label: 'routeByRisk' } },
        { id: 'left', type: 'call', properties: { label: 'siuReferral' } },
        { id: 'mid', type: 'call', properties: { label: 'humanReview' } },
        { id: 'right', type: 'set', properties: { label: 'autoApprove' } },
      ],
      [
        { id: 'e1', type: 'switch-case', source: 'switch', target: 'left' },
        { id: 'e2', type: 'switch-case', source: 'switch', target: 'mid' },
        { id: 'e3', type: 'switch-case', source: 'switch', target: 'right' },
      ],
    );
    const layout = await computeElkLayout(model, { direction: 'DOWN' });
    const { nodes } = toReactFlowGraph(model, layout, undefined, 'DOWN');
    const sw = nodes.find(n => n.id === 'switch')!;
    expect(
      (sw.data as Record<string, unknown>)._sourceHandlePosition,
      'Fan-out source should use bottom handle in DOWN layout',
    ).toBe('bottom');
  });

  it('DOWN layout: fan-in merge keeps top target handle', async () => {
    const model = createGraph(
      [
        { id: 'left', type: 'call', properties: { label: 'siuReferral' } },
        { id: 'mid', type: 'call', properties: { label: 'humanReview' } },
        { id: 'right', type: 'set', properties: { label: 'autoApprove' } },
        { id: 'merge', type: 'call', properties: { label: 'tryNotify' } },
      ],
      [
        { id: 'e1', type: 'flow', source: 'left', target: 'merge' },
        { id: 'e2', type: 'flow', source: 'mid', target: 'merge' },
        { id: 'e3', type: 'flow', source: 'right', target: 'merge' },
      ],
    );
    const layout = await computeElkLayout(model, { direction: 'DOWN' });
    const { nodes } = toReactFlowGraph(model, layout, undefined, 'DOWN');
    const merge = nodes.find(n => n.id === 'merge')!;
    expect(
      (merge.data as Record<string, unknown>)._targetHandlePosition,
      'Fan-in target should use top handle in DOWN layout',
    ).toBe('top');
  });
});

describe('no edge-node crossings', () => {
  it('vertical sequence — no crossings', async () => {
    const model = createGraph(
      [
        { id: 'a', type: 'call', properties: { label: 'A' } },
        { id: 'b', type: 'call', properties: { label: 'B' } },
        { id: 'c', type: 'call', properties: { label: 'C' } },
        { id: 'd', type: 'call', properties: { label: 'D' } },
      ],
      [
        { id: 'e1', type: 'flow', source: 'a', target: 'b' },
        { id: 'e2', type: 'flow', source: 'b', target: 'c' },
        { id: 'e3', type: 'flow', source: 'c', target: 'd' },
      ],
    );
    const layout = await computeElkLayout(model, { direction: 'DOWN' });
    const { nodes, edges } = toReactFlowGraph(model, layout, undefined, 'DOWN');
    assertNoEdgeCrossings(nodes, edges);
  });

  it('branching switch — no crossings (direction DOWN)', async () => {
    const model = createGraph(
      [
        { id: 'start', type: 'start', properties: { label: 'Start' } },
        { id: 'validate', type: 'call', properties: { label: 'validateEvidence' } },
        { id: 'switch', type: 'switch', properties: { label: 'routeByRisk' } },
        { id: 'branchA', type: 'call', properties: { label: 'siuReferral' } },
        { id: 'branchB', type: 'call', properties: { label: 'humanReview' } },
        { id: 'branchC', type: 'set', properties: { label: 'autoApprove' } },
        { id: 'merge', type: 'call', properties: { label: 'tryNotify' } },
        { id: 'end', type: 'call', properties: { label: 'recordOutcome' } },
      ],
      [
        { id: 'e1', type: 'flow', source: 'start', target: 'validate' },
        { id: 'e2', type: 'flow', source: 'validate', target: 'switch' },
        { id: 'e3', type: 'switch-case', source: 'switch', target: 'branchA' },
        { id: 'e4', type: 'switch-case', source: 'switch', target: 'branchB' },
        { id: 'e5', type: 'switch-case', source: 'switch', target: 'branchC' },
        { id: 'e6', type: 'flow', source: 'branchA', target: 'merge' },
        { id: 'e7', type: 'flow', source: 'branchB', target: 'merge' },
        { id: 'e8', type: 'flow', source: 'branchC', target: 'merge' },
        { id: 'e9', type: 'flow', source: 'merge', target: 'end' },
      ],
    );
    const layout = await computeElkLayout(model, { direction: 'DOWN' });
    const { nodes, edges } = toReactFlowGraph(model, layout, undefined, 'DOWN');
    assertNoEdgeCrossings(nodes, edges);
  });

  it('horizontal chain — no crossings (direction RIGHT)', async () => {
    const model = createGraph(
      [
        { id: 'a', type: 'binding', properties: { label: 'intake' } },
        { id: 'b', type: 'worker', properties: { label: 'validator' } },
        { id: 'c', type: 'milestone', properties: { label: 'done' } },
      ],
      [
        { id: 'e1', type: 'dispatch', source: 'a', target: 'b' },
        { id: 'e2', type: 'condition', source: 'a', target: 'c' },
      ],
    );
    const layout = await computeElkLayout(model, { direction: 'RIGHT' });
    const { nodes, edges } = toReactFlowGraph(model, layout, undefined, 'RIGHT');
    assertNoEdgeCrossings(nodes, edges);
  });

  it('wrapped snake pipeline — no crossings (direction RIGHT, wrapping)', async () => {
    const steps = Array.from({ length: 10 }, (_, i) => ({
      id: `step-${i}`,
      type: 'call' as const,
      properties: { label: `step${i}` },
    }));
    const stepEdges = steps.slice(0, -1).map((s, i) => ({
      id: `e${i}`,
      type: 'flow' as const,
      source: s.id,
      target: steps[i + 1]!.id,
    }));

    const model = createGraph(steps, stepEdges);
    const layout = await computeElkLayout(model, { direction: 'RIGHT', wrapping: true });
    const { nodes, edges } = toReactFlowGraph(model, layout, undefined, 'RIGHT');
    assertNoEdgeCrossings(nodes, edges);
  });

  it('fan-out fan-in DAG — no crossings (direction DOWN)', async () => {
    const model = createGraph(
      [
        { id: 'root', type: 'dag-node', properties: { label: 'validate' } },
        { id: 'left', type: 'dag-node', properties: { label: 'enrich-policy' } },
        { id: 'right', type: 'dag-node', properties: { label: 'enrich-claimant' } },
        { id: 'merge', type: 'dag-node', properties: { label: 'aggregate' } },
        { id: 'final', type: 'dag-node', properties: { label: 'route' } },
      ],
      [
        { id: 'e1', type: 'dep', source: 'root', target: 'left' },
        { id: 'e2', type: 'dep', source: 'root', target: 'right' },
        { id: 'e3', type: 'dep', source: 'left', target: 'merge' },
        { id: 'e4', type: 'dep', source: 'right', target: 'merge' },
        { id: 'e5', type: 'dep', source: 'merge', target: 'final' },
      ],
    );
    const layout = await computeElkLayout(model, { direction: 'DOWN' });
    const { nodes, edges } = toReactFlowGraph(model, layout, undefined, 'DOWN');
    assertNoEdgeCrossings(nodes, edges);
  });
});
