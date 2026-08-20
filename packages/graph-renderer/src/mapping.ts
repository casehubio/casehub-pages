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

function nodeBounds(node: Node): { x: number; y: number; w: number; h: number } {
  return { x: node.position.x, y: node.position.y, w: node.width ?? 280, h: node.height ?? 50 };
}

function bestHandleForEdge(
  srcBounds: { x: number; y: number; w: number; h: number },
  tgtBounds: { x: number; y: number; w: number; h: number },
): { source: string; target: string } {
  let best = { source: 'bottom', target: 'top' };
  let shortest = Infinity;
  for (const sp of POSITIONS) {
    for (const tp of POSITIONS) {
      const s = handlePosPoint(srcBounds, sp);
      const t = handlePosPoint(tgtBounds, tp);
      const d = Math.sqrt((s.x - t.x) ** 2 + (s.y - t.y) ** 2);
      if (d < shortest) { shortest = d; best = { source: sp, target: tp }; }
    }
  }
  return best;
}

function autoDetectHandleDirections(nodes: Node[], edges: Edge[], _direction?: string): void {
  if (!nodes.length || !edges.length) return;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Per-edge: compute ideal handle positions based on shortest path
  const srcVotes = new Map<string, Record<string, number>>();
  const tgtVotes = new Map<string, Record<string, number>>();

  for (const e of edges) {
    const srcNode = nodeMap.get(e.source);
    const tgtNode = nodeMap.get(e.target);
    if (!srcNode || !tgtNode) continue;

    const ideal = bestHandleForEdge(nodeBounds(srcNode), nodeBounds(tgtNode));

    const sv = srcVotes.get(e.source) ?? {};
    sv[ideal.source] = (sv[ideal.source] ?? 0) + 1;
    srcVotes.set(e.source, sv);

    const tv = tgtVotes.get(e.target) ?? {};
    tv[ideal.target] = (tv[ideal.target] ?? 0) + 1;
    tgtVotes.set(e.target, tv);
  }

  const pickBest = (votes: Record<string, number>): string => {
    let best = 'bottom';
    let max = 0;
    for (const [pos, count] of Object.entries(votes)) {
      if (count > max) { max = count; best = pos; }
    }
    return best;
  };

  const opposite: Record<string, string> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

  // Initial assignment: shortest path per edge
  for (const node of nodes) {
    const sv = srcVotes.get(node.id);
    const tv = tgtVotes.get(node.id);

    let srcPos = sv ? pickBest(sv) : undefined;
    let tgtPos = tv ? pickBest(tv) : undefined;

    // Rule 1: source and target cannot be on the same handle
    if (srcPos && tgtPos && srcPos === tgtPos) {
      tgtPos = opposite[srcPos];
    }

    const updates: Record<string, unknown> = {};
    if (srcPos) updates._sourceHandlePosition = srcPos;
    if (tgtPos) updates._targetHandlePosition = tgtPos;
    if (Object.keys(updates).length > 0) {
      node.data = { ...node.data, ...updates };
    }
  }

  // Post-process: check for edge-node crossings and fix
  resolveEdgeNodeCrossings(nodes, edges);
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

function resolveEdgeNodeCrossings(nodes: Node[], edges: Edge[]): void {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (const edge of edges) {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    if (!srcNode || !tgtNode) continue;

    const srcData = srcNode.data as Record<string, unknown>;
    const tgtData = tgtNode.data as Record<string, unknown>;
    const currentSrcPos = (srcData._sourceHandlePosition as string) ?? 'bottom';
    const currentTgtPos = (tgtData._targetHandlePosition as string) ?? 'top';
    const srcBounds = nodeBounds(srcNode);
    const tgtBounds = nodeBounds(tgtNode);

    const p1 = handlePosPoint(srcBounds, currentSrcPos);
    const p2 = handlePosPoint(tgtBounds, currentTgtPos);

    let hasCrossing = false;
    for (const node of nodes) {
      if (node.id === edge.source || node.id === edge.target || node.parentId) continue;
      const r = nodeBounds(node);
      if (lineIntersectsRect(p1, p2, r.x, r.y, r.w, r.h)) { hasCrossing = true; break; }
    }

    if (!hasCrossing) continue;

    // Try all handle combos to find one without crossings, preferring shortest
    let bestSrc = currentSrcPos, bestTgt = currentTgtPos;
    let bestDist = Infinity;
    for (const sp of POSITIONS) {
      for (const tp of POSITIONS) {
        if (sp === (tgtData._targetHandlePosition as string | undefined) && sp === tp) continue;
        const s = handlePosPoint(srcBounds, sp);
        const t = handlePosPoint(tgtBounds, tp);
        let crosses = false;
        for (const node of nodes) {
          if (node.id === edge.source || node.id === edge.target || node.parentId) continue;
          const r = nodeBounds(node);
          if (lineIntersectsRect(s, t, r.x, r.y, r.w, r.h)) { crosses = true; break; }
        }
        if (crosses) continue;
        const d = Math.sqrt((s.x - t.x) ** 2 + (s.y - t.y) ** 2);
        if (d < bestDist) { bestDist = d; bestSrc = sp; bestTgt = tp; }
      }
    }

    srcNode.data = { ...srcNode.data, _sourceHandlePosition: bestSrc };
    tgtNode.data = { ...tgtNode.data, _targetHandlePosition: bestTgt };
  }
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
