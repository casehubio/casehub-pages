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
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const parentIds = new Set(nodes.filter(n => n.parentId).map(n => n.parentId!));

  function checkCrossing(s: { x: number; y: number }, t: { x: number; y: number }, srcId: string, tgtId: string): boolean {
    for (const node of nodes) {
      if (node.id === srcId || node.id === tgtId) continue;
      if (parentIds.has(node.id)) continue;
      const r = absoluteBounds(node, nodeMap);
      if (lineIntersectsRect(s, t, r.x, r.y, r.w, r.h)) return true;
    }
    return false;
  }

  for (const edge of edges) {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    if (!srcNode || !tgtNode) continue;

    const srcBounds = absoluteBounds(srcNode, nodeMap);
    const tgtBounds = absoluteBounds(tgtNode, nodeMap);

    let bestSrc = 'bottom';
    let bestTgt = 'top';
    let bestDist = Infinity;

    for (const sp of POSITIONS) {
      for (const tp of POSITIONS) {
        if (sp === tp) continue;
        const s = handlePosPoint(srcBounds, sp);
        const t = handlePosPoint(tgtBounds, tp);
        if (checkCrossing(s, t, edge.source, edge.target)) continue;
        const d = Math.sqrt((s.x - t.x) ** 2 + (s.y - t.y) ** 2);
        if (d < bestDist) { bestDist = d; bestSrc = sp; bestTgt = tp; }
      }
    }

    edge.sourceHandle = `source-${bestSrc}`;
    edge.targetHandle = `target-${bestTgt}`;
  }

  // Post-process: resolve per-node conflicts where incoming and outgoing share a side
  const outSides = new Map<string, Set<string>>();
  const inEdges = new Map<string, Edge[]>();
  for (const edge of edges) {
    const sp = edge.sourceHandle?.replace('source-', '') ?? 'bottom';
    outSides.set(edge.source, (outSides.get(edge.source) ?? new Set()).add(sp));
    const ie = inEdges.get(edge.target) ?? [];
    ie.push(edge);
    inEdges.set(edge.target, ie);
  }
  for (const [nodeId, incoming] of inEdges) {
    const outs = outSides.get(nodeId);
    if (!outs) continue;
    for (const edge of incoming) {
      const tp = edge.targetHandle?.replace('target-', '') ?? 'top';
      if (!outs.has(tp)) continue;
      const tgtNode = nodeMap.get(edge.target);
      const srcNode = nodeMap.get(edge.source);
      if (!tgtNode || !srcNode) continue;
      const srcBounds = absoluteBounds(srcNode, nodeMap);
      const tgtBounds = absoluteBounds(tgtNode, nodeMap);
      const sp = edge.sourceHandle?.replace('source-', '') ?? 'bottom';
      let bestTp = tp;
      let bestDist = Infinity;
      for (const candidate of POSITIONS) {
        if (candidate === sp || candidate === tp) continue;
        if (outs.has(candidate)) continue;
        const s = handlePosPoint(srcBounds, sp);
        const t = handlePosPoint(tgtBounds, candidate);
        if (checkCrossing(s, t, edge.source, edge.target)) continue;
        const d = Math.sqrt((s.x - t.x) ** 2 + (s.y - t.y) ** 2);
        if (d < bestDist) { bestDist = d; bestTp = candidate; }
      }
      if (bestTp !== tp) {
        edge.targetHandle = `target-${bestTp}`;
      }
    }
  }

  // Set per-node default positions (most common direction across edges) for handle visibility
  const srcCounts = new Map<string, Record<string, number>>();
  const tgtCounts = new Map<string, Record<string, number>>();
  for (const edge of edges) {
    const sp = edge.sourceHandle?.replace('source-', '') ?? 'bottom';
    const tp = edge.targetHandle?.replace('target-', '') ?? 'top';
    const sc = srcCounts.get(edge.source) ?? {};
    sc[sp] = (sc[sp] ?? 0) + 1;
    srcCounts.set(edge.source, sc);
    const tc = tgtCounts.get(edge.target) ?? {};
    tc[tp] = (tc[tp] ?? 0) + 1;
    tgtCounts.set(edge.target, tc);
  }

  for (const node of nodes) {
    const sc = srcCounts.get(node.id);
    const tc = tgtCounts.get(node.id);
    const updates: Record<string, unknown> = {};
    if (sc) updates._sourceHandlePosition = Object.entries(sc).sort((a, b) => b[1] - a[1])[0]![0];
    if (tc) updates._targetHandlePosition = Object.entries(tc).sort((a, b) => b[1] - a[1])[0]![0];
    if (Object.keys(updates).length > 0) {
      node.data = { ...node.data, ...updates };
    }
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
