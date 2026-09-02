import type { GraphNode, GraphEdge, GraphModel, NodeDecoration } from '@casehubio/graph-core';
import { getGrammar } from '@casehubio/graph-core';
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

function _nodeBounds(node: Node): { x: number; y: number; w: number; h: number } {
  return { x: node.position.x, y: node.position.y, w: node.width ?? 280, h: node.height ?? 50 };
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

function autoDetectHandleDirections(nodes: Node[], edges: Edge[], _direction?: string): void {
  if (!nodes.length || !edges.length) return;

  // Per-node defaults set the primary handle direction; the per-edge
  // algorithm below then assigns optimal handles per edge.
  const dirDefaults: Record<string, { src: string; tgt: string }> = {
    DOWN: { src: 'bottom', tgt: 'top' },
    RIGHT: { src: 'right', tgt: 'left' },
    LEFT: { src: 'left', tgt: 'right' },
    UP: { src: 'top', tgt: 'bottom' },
  };
  const perpendicular: Record<string, { src: string; tgt: string }> = {
    DOWN: { src: 'right', tgt: 'left' },
    RIGHT: { src: 'bottom', tgt: 'top' },
    LEFT: { src: 'bottom', tgt: 'top' },
    UP: { src: 'right', tgt: 'left' },
  };
  const defaults = dirDefaults[_direction ?? 'DOWN'] ?? dirDefaults.DOWN!;

  for (const node of nodes) {
    const hasOutgoing = edges.some(e => e.source === node.id);
    const hasIncoming = edges.some(e => e.target === node.id);
    const grammar = node.type ? getGrammar(node.type) : undefined;
    const canHaveOutgoing = hasOutgoing || (grammar ? grammar.connections.outbound.max > 0 : false);
    const canHaveIncoming = hasIncoming || (grammar ? grammar.connections.inbound.max > 0 : false);
    const updates: Record<string, unknown> = {};
    if (canHaveOutgoing) updates._sourceHandlePosition = defaults.src;
    if (canHaveIncoming) updates._targetHandlePosition = defaults.tgt;
    if (Object.keys(updates).length > 0) {
      node.data = { ...node.data, ...updates };
    }
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const parentIds = new Set(nodes.filter(n => n.parentId).map(n => n.parentId!));
  function scopeNodes(srcId: string, tgtId: string): Node[] {
    const srcParent = nodeMap.get(srcId)?.parentId;
    const tgtParent = nodeMap.get(tgtId)?.parentId;
    return nodes.filter(node => {
      if (node.id === srcId || node.id === tgtId) return false;
      if (node.id === srcParent || node.id === tgtParent) return false;
      if (!srcParent && !tgtParent) return !node.parentId;
      if (parentIds.has(node.id)) return node.parentId === srcParent || node.parentId === tgtParent || !node.parentId;
      return node.parentId === srcParent || node.parentId === tgtParent;
    });
  }
  function checkCrossing(s: { x: number; y: number }, t: { x: number; y: number }, srcId: string, tgtId: string): boolean {
    for (const node of scopeNodes(srcId, tgtId)) {
      const r = absoluteBounds(node, nodeMap);
      if (lineIntersectsRect(s, t, r.x, r.y, r.w, r.h)) return true;
    }
    return false;
  }
  function corridorBlocked(s: { x: number; y: number }, t: { x: number; y: number }, srcId: string, tgtId: string): boolean {
    const margin = 10;
    const cx = Math.min(s.x, t.x) - margin;
    const cy = Math.min(s.y, t.y) - margin;
    const cw = Math.abs(s.x - t.x) + 2 * margin;
    const ch = Math.abs(s.y - t.y) + 2 * margin;
    for (const node of scopeNodes(srcId, tgtId)) {
      const r = absoluteBounds(node, nodeMap);
      if (r.x + r.w > cx && r.x < cx + cw && r.y + r.h > cy && r.y < cy + ch) return true;
    }
    return false;
  }
  const usedOut = new Map<string, Set<string>>();
  const usedIn = new Map<string, Set<string>>();
  for (const edge of edges) {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    if (!srcNode || !tgtNode) continue;
    const srcBounds = absoluteBounds(srcNode, nodeMap);
    const tgtBounds = absoluteBounds(tgtNode, nodeMap);
    const srcIn = usedIn.get(edge.source);
    const tgtOut = usedOut.get(edge.target);
    const perp = perpendicular[_direction ?? 'DOWN'] ?? perpendicular.DOWN!;
    let bestSrc = defaults.src;
    let bestTgt = defaults.tgt;
    let resolved = false;
    function canUse(sp: string, tp: string): boolean {
      if (sp === tp) return false;
      if (srcIn && srcIn.has(sp)) return false;
      if (tgtOut && tgtOut.has(tp)) return false;
      const s = handlePosPoint(srcBounds, sp);
      const t = handlePosPoint(tgtBounds, tp);
      return !checkCrossing(s, t, edge.source, edge.target);
    }
    const dir = _direction ?? 'DOWN';
    const srcCx = srcBounds.x + srcBounds.w / 2;
    const srcCy = srcBounds.y + srcBounds.h / 2;
    const tgtCx = tgtBounds.x + tgtBounds.w / 2;
    const tgtCy = tgtBounds.y + tgtBounds.h / 2;
    const flowsForward = (dir === 'RIGHT' || dir === 'LEFT')
      ? (dir === 'RIGHT' ? tgtCx > srcCx : tgtCx < srcCx)
      : (dir === 'DOWN' ? tgtCy > srcCy : tgtCy < srcCy);
    const primary = flowsForward ? defaults : perp;
    const secondary = flowsForward ? perp : defaults;
    if (canUse(primary.src, primary.tgt)) {
      bestSrc = primary.src;
      bestTgt = primary.tgt;
      resolved = true;
    }
    if (!resolved && canUse(secondary.src, secondary.tgt)) {
      bestSrc = secondary.src;
      bestTgt = secondary.tgt;
      resolved = true;
    }
    if (!resolved) {
      let bestDist = Infinity;
      for (const sp of POSITIONS) {
        if (srcIn && srcIn.has(sp)) continue;
        for (const tp of POSITIONS) {
          if (sp === tp) continue;
          if (tgtOut && tgtOut.has(tp)) continue;
          const s = handlePosPoint(srcBounds, sp);
          const t = handlePosPoint(tgtBounds, tp);
          if (checkCrossing(s, t, edge.source, edge.target)) continue;
          if (corridorBlocked(s, t, edge.source, edge.target)) continue;
          const d = Math.sqrt((s.x - t.x) ** 2 + (s.y - t.y) ** 2);
          if (d < bestDist) { bestDist = d; bestSrc = sp; bestTgt = tp; }
        }
      }
    }
    edge.sourceHandle = `source-${bestSrc}`;
    edge.targetHandle = `target-${bestTgt}`;
    if (!usedOut.has(edge.source)) usedOut.set(edge.source, new Set());
    usedOut.get(edge.source)!.add(bestSrc);
    if (!usedIn.has(edge.target)) usedIn.set(edge.target, new Set());
    usedIn.get(edge.target)!.add(bestTgt);
  }

  const srcCounts = new Map<string, Record<string, number>>();
  const tgtCounts = new Map<string, Record<string, number>>();
  for (const edge of edges) {
    const sp = edge.sourceHandle?.replace(/^source-/, '') ?? defaults.src;
    const tp = edge.targetHandle?.replace(/^target-/, '') ?? defaults.tgt;
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
    else if (!hasOutgoing.has(node.id)) {
      const g = node.type ? getGrammar(node.type) : undefined;
      if (!g || g.connections.outbound.max === 0) updates._sourceHandlePosition = undefined;
    }
    if (tc) updates._targetHandlePosition = Object.entries(tc).sort((a, b) => b[1] - a[1])[0]![0];
    else if (!hasIncoming.has(node.id)) {
      const g = node.type ? getGrammar(node.type) : undefined;
      if (!g || g.connections.inbound.max === 0) updates._targetHandlePosition = undefined;
    }
    node.data = { ...node.data, ...updates };
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
