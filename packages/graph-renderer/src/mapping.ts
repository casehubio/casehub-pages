import type { GraphNode, GraphEdge, GraphModel, NodeDecoration } from '@casehubio/graph-core';
import type { Node, Edge } from '@xyflow/react';
import type { NodeLayout, ElkLayoutResult } from './layout/elk-layout.js';

const DEFAULT_PARENT_WIDTH = 280;
const DEFAULT_PARENT_HEIGHT = 180;

export function toReactFlowNode(
  node: GraphNode,
  parentIds: ReadonlySet<string>,
  nodeLayout?: NodeLayout,
  decoration?: NodeDecoration,
): Node {
  const rfNode: Node = {
    id: node.id,
    type: node.type,
    position: nodeLayout
      ? { x: nodeLayout.x, y: nodeLayout.y }
      : { x: 0, y: 0 },
    data: {
      ...node.properties,
      ...(decoration ? { _decoration: decoration } : {}),
    },
  };

  if (nodeLayout) {
    rfNode.width = nodeLayout.width;
    rfNode.height = nodeLayout.height;
  }

  if (node.parentId) {
    rfNode.parentId = node.parentId;
  }

  if (parentIds.has(node.id)) {
    rfNode.style = nodeLayout
      ? { width: nodeLayout.width, height: nodeLayout.height }
      : { width: DEFAULT_PARENT_WIDTH, height: DEFAULT_PARENT_HEIGHT };
  }

  return rfNode;
}

export function toReactFlowEdge(edge: GraphEdge): Edge {
  const rfEdge: Edge = {
    id: edge.id,
    type: edge.type || undefined,
    source: edge.source,
    target: edge.target,
  };

  if (edge.properties) {
    rfEdge.data = { ...edge.properties };
  }

  return rfEdge;
}

const POSITIONS = ['top', 'bottom', 'left', 'right'] as const;

function handlePosPoint(rect: { x: number; y: number; w: number; h: number }, pos: string): { x: number; y: number } {
  switch (pos) {
    case 'top': return { x: rect.x + rect.w / 2, y: rect.y };
    case 'bottom': return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
    case 'left': return { x: rect.x, y: rect.y + rect.h / 2 };
    case 'right': return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
    default: return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
  }
}


function absoluteBounds(node: Node, nodeMap: Map<string, Node>): { x: number; y: number; w: number; h: number } {
  let x = node.position.x;
  let y = node.position.y;
  let cur = node;
  while (cur.parentId) {
    const parent = nodeMap.get(cur.parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    cur = parent;
  }
  return { x, y, w: node.width ?? 280, h: node.height ?? 50 };
}

interface HandleCandidate {
  srcSide: string;
  tgtSide: string;
  srcPt: { x: number; y: number };
  tgtPt: { x: number; y: number };
  dist: number;
}

function segmentsIntersect(
  a1: { x: number; y: number }, a2: { x: number; y: number },
  b1: { x: number; y: number }, b2: { x: number; y: number },
): boolean {
  const d1x = a2.x - a1.x, d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x, d2y = b2.y - b1.y;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false;
  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / cross;
  const u = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / cross;
  return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
}

function autoDetectHandleDirections(nodes: Node[], edges: Edge[], _direction?: string): void {
  if (!nodes.length || !edges.length) return;

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const SIDES = ['top', 'bottom', 'left', 'right'] as const;

  function absBounds(node: Node): { x: number; y: number; w: number; h: number } {
    let x = node.position.x, y = node.position.y;
    let cur = node;
    while (cur.parentId) {
      const parent = nodeMap.get(cur.parentId);
      if (!parent) break;
      x += parent.position.x; y += parent.position.y;
      cur = parent;
    }
    return { x, y, w: node.width ?? 280, h: node.height ?? 50 };
  }

  function handlePoint(bounds: { x: number; y: number; w: number; h: number }, side: string) {
    switch (side) {
      case 'top': return { x: bounds.x + bounds.w / 2, y: bounds.y };
      case 'bottom': return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h };
      case 'left': return { x: bounds.x, y: bounds.y + bounds.h / 2 };
      case 'right': return { x: bounds.x + bounds.w, y: bounds.y + bounds.h / 2 };
      default: return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h };
    }
  }

  function ancestors(nodeId: string): Set<string> {
    const result = new Set<string>();
    let cur = nodeMap.get(nodeId);
    while (cur?.parentId) { result.add(cur.parentId); cur = nodeMap.get(cur.parentId); }
    return result;
  }

  function lineCrossesNode(
    s: { x: number; y: number }, t: { x: number; y: number },
    srcId: string, tgtId: string,
  ): boolean {
    const srcAnc = ancestors(srcId);
    const tgtAnc = ancestors(tgtId);
    for (const node of nodes) {
      if (node.id === srcId || node.id === tgtId) continue;
      if (srcAnc.has(node.id) || tgtAnc.has(node.id)) continue;
      if (node.parentId === srcId || node.parentId === tgtId) continue;
      const r = absBounds(node);
      if (lineIntersectsRect(s, t, r.x, r.y, r.w, r.h)) return true;
    }
    return false;
  }

  const edgeCandidates: HandleCandidate[][] = [];
  const validEdges: Edge[] = [];

  for (const edge of edges) {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    if (!srcNode || !tgtNode) continue;
    const srcB = absBounds(srcNode);
    const tgtB = absBounds(tgtNode);
    const candidates: HandleCandidate[] = [];
    for (const ss of SIDES) {
      for (const ts of SIDES) {
        if (ss === ts) continue;
        const sp = handlePoint(srcB, ss);
        const tp = handlePoint(tgtB, ts);
        if (lineCrossesNode(sp, tp, edge.source, edge.target)) continue;
        const dist = Math.sqrt((sp.x - tp.x) ** 2 + (sp.y - tp.y) ** 2);
        candidates.push({ srcSide: ss, tgtSide: ts, srcPt: sp, tgtPt: tp, dist });
      }
    }
    if (candidates.length === 0) {
      for (const ss of SIDES) {
        for (const ts of SIDES) {
          if (ss === ts) continue;
          const sp = handlePoint(srcB, ss);
          const tp = handlePoint(tgtB, ts);
          const dist = Math.sqrt((sp.x - tp.x) ** 2 + (sp.y - tp.y) ** 2);
          candidates.push({ srcSide: ss, tgtSide: ts, srcPt: sp, tgtPt: tp, dist });
        }
      }
    }
    candidates.sort((a, b) => a.dist - b.dist);
    edgeCandidates.push(candidates);
    validEdges.push(edge);
  }

  if (validEdges.length === 0) return;

  let bestCrossings = Infinity;
  let bestTotalDist = Infinity;
  let bestAssignment: HandleCandidate[] = [];
  const current: HandleCandidate[] = new Array(validEdges.length);
  const MAX_ITERATIONS = 500_000;
  let iterations = 0;

  function countCrossingsWith(depth: number, candidate: HandleCandidate): number {
    let crossings = 0;
    const ae = validEdges[depth]!;
    for (let j = 0; j < depth; j++) {
      const b = current[j]!;
      const be = validEdges[j]!;
      if (ae.source === be.source || ae.target === be.target ||
          ae.source === be.target || ae.target === be.source) continue;
      if (segmentsIntersect(candidate.srcPt, candidate.tgtPt, b.srcPt, b.tgtPt)) crossings++;
    }
    return crossings;
  }

  function search(depth: number, crossingsSoFar: number): void {
    if (iterations++ > MAX_ITERATIONS) return;
    if (depth === validEdges.length) {
      const totalDist = current.reduce((sum, c) => sum + c.dist, 0);
      if (crossingsSoFar < bestCrossings ||
          (crossingsSoFar === bestCrossings && totalDist < bestTotalDist)) {
        bestCrossings = crossingsSoFar;
        bestTotalDist = totalDist;
        bestAssignment = [...current];
      }
      return;
    }
    for (const candidate of edgeCandidates[depth]!) {
      if (iterations > MAX_ITERATIONS) return;
      const newCrossings = countCrossingsWith(depth, candidate);
      const total = crossingsSoFar + newCrossings;
      if (total >= bestCrossings) continue;
      current[depth] = candidate;
      search(depth + 1, total);
      if (bestCrossings === 0) return;
    }
  }

  search(0, 0);

  for (let i = 0; i < validEdges.length; i++) {
    const edge = validEdges[i]!;
    const candidate = bestAssignment[i]!;
    edge.sourceHandle = `source-${candidate.srcSide}`;
    edge.targetHandle = `target-${candidate.tgtSide}`;
  }

  const srcCounts = new Map<string, Record<string, number>>();
  const tgtCounts = new Map<string, Record<string, number>>();
  for (const edge of edges) {
    const sp = edge.sourceHandle?.replace(/^source-/, '') ?? 'bottom';
    const tp = edge.targetHandle?.replace(/^target-/, '') ?? 'top';
    const sc = srcCounts.get(edge.source) ?? {};
    sc[sp] = (sc[sp] ?? 0) + 1;
    srcCounts.set(edge.source, sc);
    const tc = tgtCounts.get(edge.target) ?? {};
    tc[tp] = (tc[tp] ?? 0) + 1;
    tgtCounts.set(edge.target, tc);
  }
  const hasOutgoing = new Set(edges.map(e => e.source));
  const hasIncoming = new Set(edges.map(e => e.target));
  for (const node of nodes) {
    const sc = srcCounts.get(node.id);
    const tc = tgtCounts.get(node.id);
    const updates: Record<string, unknown> = {};
    if (sc) updates._sourceHandlePosition = Object.entries(sc).sort((a, b) => b[1] - a[1])[0]![0];
    else if (!hasOutgoing.has(node.id)) updates._sourceHandlePosition = undefined;
    if (tc) updates._targetHandlePosition = Object.entries(tc).sort((a, b) => b[1] - a[1])[0]![0];
    else if (!hasIncoming.has(node.id)) updates._targetHandlePosition = undefined;
    if (Object.keys(updates).length > 0) node.data = { ...node.data, ...updates };
  }
}

function lineIntersectsRect(
  p1: { x: number; y: number }, p2: { x: number; y: number },
  rx: number, ry: number, rw: number, rh: number,
): boolean {
  const margin = 5;
  const x = rx + margin, y = ry + margin, w = rw - 2 * margin, h = rh - 2 * margin;
  if (w <= 0 || h <= 0) return false;
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  let tMin = 0, tMax = 1;
  const sides = [{ p: -dx, q: -(x - p1.x) }, { p: dx, q: x + w - p1.x }, { p: -dy, q: -(y - p1.y) }, { p: dy, q: y + h - p1.y }];
  for (const { p, q } of sides) {
    if (Math.abs(p) < 1e-10) { if (q < 0) return false; }
    else { const t = q / p; if (p < 0) { if (t > tMax) return false; if (t > tMin) tMin = t; } else { if (t < tMin) return false; if (t < tMax) tMax = t; } }
  }
  return tMin <= tMax;
}


export function toReactFlowGraph(
  model: GraphModel,
  layout?: ElkLayoutResult,
  decorations?: ReadonlyMap<string, NodeDecoration>,
  layoutDirection?: string,
): { nodes: Node[]; edges: Edge[] } {
  const parentIds = new Set<string>();
  for (const node of model.nodes) {
    if (node.parentId) {
      parentIds.add(node.parentId);
    }
  }

  const nodes = model.nodes.map(n =>
    toReactFlowNode(n, parentIds, layout?.nodeLayouts.get(n.id), decorations?.get(n.id)),
  );
  const edges = model.edges.map(e => toReactFlowEdge(e));

  if (layout) {
    autoDetectHandleDirections(nodes, edges, layoutDirection);
  }

  return { nodes, edges };
}
