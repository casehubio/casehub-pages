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

  const validEdges: Edge[] = [];
  for (const edge of edges) {
    if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) validEdges.push(edge);
  }
  if (validEdges.length === 0) return;

  function buildCandidates(): HandleCandidate[][] {
    const result: HandleCandidate[][] = [];
    for (const edge of validEdges) {
      const srcB = absBounds(nodeMap.get(edge.source)!);
      const tgtB = absBounds(nodeMap.get(edge.target)!);
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
      result.push(candidates);
    }
    return result;
  }

  function optimise(edgeCandidates: HandleCandidate[][], maxIter = 500_000): { crossings: number; totalDist: number; assignment: HandleCandidate[] } {
    let bestCr = Infinity;
    let bestDist = Infinity;
    let bestAsgn: HandleCandidate[] = [];
    const cur: HandleCandidate[] = new Array(validEdges.length);
    const MAX_ITER = maxIter;
    let iters = 0;

    function countWith(depth: number, candidate: HandleCandidate): number {
      let cr = 0;
      const ae = validEdges[depth]!;
      for (let j = 0; j < depth; j++) {
        const b = cur[j]!;
        const be = validEdges[j]!;
        if (ae.source === be.source || ae.target === be.target ||
            ae.source === be.target || ae.target === be.source) continue;
        if (segmentsIntersect(candidate.srcPt, candidate.tgtPt, b.srcPt, b.tgtPt)) cr++;
      }
      return cr;
    }

    function srch(depth: number, soFar: number): void {
      if (iters++ > MAX_ITER) return;
      if (depth === validEdges.length) {
        const td = cur.reduce((s, c) => s + c.dist, 0);
        if (soFar < bestCr || (soFar === bestCr && td < bestDist)) {
          bestCr = soFar; bestDist = td; bestAsgn = [...cur];
        }
        return;
      }
      for (const cand of edgeCandidates[depth]!) {
        if (iters > MAX_ITER) return;
        const nc = countWith(depth, cand);
        const total = soFar + nc;
        if (total >= bestCr) continue;
        cur[depth] = cand;
        srch(depth + 1, total);
        if (bestCr === 0) return;
      }
    }

    srch(0, 0);
    return { crossings: bestCr, totalDist: bestDist, assignment: bestAsgn };
  }

  function countAllViolations(assignment: HandleCandidate[]): number {
    let violations = 0;
    for (let i = 0; i < assignment.length; i++) {
      const a = assignment[i]!;
      const ae = validEdges[i]!;
      if (lineCrossesNode(a.srcPt, a.tgtPt, ae.source, ae.target)) violations++;
      for (let j = i + 1; j < assignment.length; j++) {
        const b = assignment[j]!;
        const be = validEdges[j]!;
        if (ae.source === be.source || ae.target === be.target ||
            ae.source === be.target || ae.target === be.source) continue;
        if (segmentsIntersect(a.srcPt, a.tgtPt, b.srcPt, b.tgtPt)) violations++;
      }
    }
    return violations;
  }

  let candidates = buildCandidates();
  let result = optimise(candidates);
  let totalViolations = countAllViolations(result.assignment);

  // Phase 2: position offsets for remaining crossings
  if (totalViolations > 0) {
    const OFFSETS = [20, -20, 40, -40, 60, -60];
    const crossingNodeIds = new Set<string>();
    for (let i = 0; i < result.assignment.length; i++) {
      const a = result.assignment[i]!;
      const ae = validEdges[i]!;
      for (let j = i + 1; j < result.assignment.length; j++) {
        const b = result.assignment[j]!;
        const be = validEdges[j]!;
        if (ae.source === be.source || ae.target === be.target ||
            ae.source === be.target || ae.target === be.source) continue;
        if (segmentsIntersect(a.srcPt, a.tgtPt, b.srcPt, b.tgtPt)) {
          crossingNodeIds.add(ae.source); crossingNodeIds.add(ae.target);
          crossingNodeIds.add(be.source); crossingNodeIds.add(be.target);
        }
      }
      if (lineCrossesNode(a.srcPt, a.tgtPt, ae.source, ae.target)) {
        crossingNodeIds.add(ae.source); crossingNodeIds.add(ae.target);
        const srcAnc = ancestors(ae.source);
        const tgtAnc = ancestors(ae.target);
        for (const n of nodes) {
          if (n.id === ae.source || n.id === ae.target) continue;
          if (srcAnc.has(n.id) || tgtAnc.has(n.id)) continue;
          const r = absBounds(n);
          if (lineIntersectsRect(a.srcPt, a.tgtPt, r.x, r.y, r.w, r.h)) {
            crossingNodeIds.add(n.id);
          }
        }
      }
    }

    const OFFSET_BUDGET = 50_000;
    for (const nodeId of crossingNodeIds) {
      if (totalViolations === 0) break;
      const node = nodeMap.get(nodeId);
      if (!node) continue;
      const origX = node.position.x;
      const origY = node.position.y;
      let improved = false;
      for (const off of OFFSETS) {
        if (totalViolations === 0) break;
        for (const [dx, dy] of [[off, 0], [0, off], [off, off], [off, -off]] as const) {
          node.position = { x: origX + dx, y: origY + dy };
          const tryCands = buildCandidates();
          const tryResult = optimise(tryCands, OFFSET_BUDGET);
          const tryViolations = countAllViolations(tryResult.assignment);
          if (tryViolations < totalViolations) {
            result = tryResult;
            candidates = tryCands;
            totalViolations = tryViolations;
            improved = true;
          }
          if (totalViolations === 0) break;
        }
      }
      if (!improved) {
        node.position = { x: origX, y: origY };
      }
    }
  }

  for (let i = 0; i < validEdges.length; i++) {
    const edge = validEdges[i]!;
    const candidate = result.assignment[i]!;
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
