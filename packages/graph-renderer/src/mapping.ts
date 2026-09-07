import type { GraphNode, GraphEdge, GraphModel, NodeDecoration } from '@casehubio/graph-core';
import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { NodeLayout, ElkLayoutResult } from './layout/elk-layout.js';
import { getEdgeDescriptor } from './registry/stencil-registry.js';
import type { EdgeMarker } from './registry/stencil-registry.js';

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

function toRfMarker(marker: EdgeMarker) {
  const m: { type: MarkerType; color?: string; width?: number; height?: number } = {
    type: marker.type === 'arrowclosed' ? MarkerType.ArrowClosed : MarkerType.Arrow,
    width: 20,
    height: 20,
  };
  if (marker.color) m.color = marker.color;
  return m;
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

  const desc = edge.type ? getEdgeDescriptor(edge.type) : undefined;
  if (desc?.markerEnd) rfEdge.markerEnd = toRfMarker(desc.markerEnd);
  if (desc?.markerStart) rfEdge.markerStart = toRfMarker(desc.markerStart);

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
  crossesNode: boolean;
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

  const dirDefaults: Record<string, { src: string; tgt: string }> = {
    DOWN: { src: 'bottom', tgt: 'top' },
    RIGHT: { src: 'right', tgt: 'left' },
    LEFT: { src: 'left', tgt: 'right' },
    UP: { src: 'top', tgt: 'bottom' },
  };
  const preferred = dirDefaults[_direction ?? ''];
  const DIRECTION_PENALTY = 300;

  const perpDefaults: Record<string, { src: string; tgt: string }> = {
    DOWN: { src: 'right', tgt: 'left' },
    RIGHT: { src: 'bottom', tgt: 'top' },
    LEFT: { src: 'bottom', tgt: 'top' },
    UP: { src: 'right', tgt: 'left' },
  };

  function angleToSide(a: number): string {
    while (a >= Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    if (a >= -Math.PI / 4 && a < Math.PI / 4) return 'right';
    if (a >= Math.PI / 4 && a < 3 * Math.PI / 4) return 'bottom';
    if (a >= -3 * Math.PI / 4 && a < -Math.PI / 4) return 'top';
    return 'left';
  }

  const assignedPairs = new Set<string>();

  function buildCandidates(): HandleCandidate[][] {
    const result: HandleCandidate[][] = [];
    assignedPairs.clear();
    for (const edge of validEdges) {
      const srcB = absBounds(nodeMap.get(edge.source)!);
      const tgtB = absBounds(nodeMap.get(edge.target)!);
      const srcCx = srcB.x + srcB.w / 2, srcCy = srcB.y + srcB.h / 2;
      const tgtCx = tgtB.x + tgtB.w / 2, tgtCy = tgtB.y + tgtB.h / 2;
      let edgePref = preferred;
      if (preferred && _direction) {
        const horiz = _direction === 'RIGHT' || _direction === 'LEFT';
        const flowsForward = horiz
          ? (_direction === 'RIGHT' ? tgtCx > srcCx : tgtCx < srcCx)
          : (_direction === 'DOWN' ? tgtCy > srcCy : tgtCy < srcCy);
        if (!flowsForward) edgePref = perpDefaults[_direction] ?? preferred;
      }
      if (!edgePref) {
        const angle = Math.atan2(tgtCy - srcCy, tgtCx - srcCx);
        const reverseKey = `${edge.target}:${edge.source}`;
        const rot = assignedPairs.has(reverseKey) ? Math.PI / 2 : 0;
        edgePref = { src: angleToSide(angle + rot), tgt: angleToSide(angle + Math.PI + rot) };
        assignedPairs.add(`${edge.source}:${edge.target}`);
      }
      const candidates: HandleCandidate[] = [];
      for (const ss of SIDES) {
        for (const ts of SIDES) {
          if (ss === ts) continue;
          const sp = handlePoint(srcB, ss);
          const tp = handlePoint(tgtB, ts);
          const crosses = lineCrossesNode(sp, tp, edge.source, edge.target);
          let penalty = 0;
          if (edgePref) {
            const pen = preferred ? DIRECTION_PENALTY : 1000;
            if (ss !== edgePref.src) penalty += pen;
            if (ts !== edgePref.tgt) penalty += pen;
          }
          const dist = Math.sqrt((sp.x - tp.x) ** 2 + (sp.y - tp.y) ** 2) + penalty;
          candidates.push({ srcSide: ss, tgtSide: ts, srcPt: sp, tgtPt: tp, dist, crossesNode: crosses });
        }
      }
      candidates.sort((a, b) => {
        if (a.crossesNode !== b.crossesNode) return a.crossesNode ? 1 : -1;
        return a.dist - b.dist;
      });
      result.push(candidates);
    }
    return result;
  }

  function optimise(edgeCandidates: HandleCandidate[][], maxIter = 500_000): { crossings: number; sameSideConflicts: number; totalDist: number; assignment: HandleCandidate[] } {
    let bestCross = Infinity;
    let bestSS = Infinity;
    let bestDist = Infinity;
    let bestAsgn: HandleCandidate[] = [];
    const cur: HandleCandidate[] = new Array(validEdges.length);
    const MAX_ITER = maxIter;
    let iters = 0;
    const nodeSrcCount = new Map<string, Map<string, number>>();
    const nodeTgtCount = new Map<string, Map<string, number>>();

    function getSrcCount(nodeId: string, side: string): number {
      return nodeSrcCount.get(nodeId)?.get(side) ?? 0;
    }

    function getTgtCount(nodeId: string, side: string): number {
      return nodeTgtCount.get(nodeId)?.get(side) ?? 0;
    }

    function handleCongestion(depth: number, cand: HandleCandidate): number {
      const ae = validEdges[depth]!;
      let congestion = 0;
      const tgtOnSrcSide = getTgtCount(ae.source, cand.srcSide);
      if (tgtOnSrcSide > 0) congestion++;
      const srcOnTgtSide = getSrcCount(ae.target, cand.tgtSide);
      if (srcOnTgtSide > 0) congestion++;
      return congestion;
    }

    function addCounts(depth: number, cand: HandleCandidate): void {
      const ae = validEdges[depth]!;
      if (!nodeSrcCount.has(ae.source)) nodeSrcCount.set(ae.source, new Map());
      const sm = nodeSrcCount.get(ae.source)!;
      sm.set(cand.srcSide, (sm.get(cand.srcSide) ?? 0) + 1);
      if (!nodeTgtCount.has(ae.target)) nodeTgtCount.set(ae.target, new Map());
      const tm = nodeTgtCount.get(ae.target)!;
      tm.set(cand.tgtSide, (tm.get(cand.tgtSide) ?? 0) + 1);
    }

    function removeCounts(depth: number, cand: HandleCandidate): void {
      const ae = validEdges[depth]!;
      const sm = nodeSrcCount.get(ae.source);
      if (sm) { const v = sm.get(cand.srcSide) ?? 0; if (v <= 1) sm.delete(cand.srcSide); else sm.set(cand.srcSide, v - 1); }
      const tm = nodeTgtCount.get(ae.target);
      if (tm) { const v = tm.get(cand.tgtSide) ?? 0; if (v <= 1) tm.delete(cand.tgtSide); else tm.set(cand.tgtSide, v - 1); }
    }

    function countCrossings(depth: number, candidate: HandleCandidate): number {
      let cr = candidate.crossesNode ? 1 : 0;
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

    function srch(depth: number, crossSoFar: number, ssSoFar: number): void {
      if (iters++ > MAX_ITER) return;
      if (depth === validEdges.length) {
        const td = cur.reduce((s, c) => s + c.dist, 0);
        if (crossSoFar < bestCross ||
            (crossSoFar === bestCross && ssSoFar < bestSS) ||
            (crossSoFar === bestCross && ssSoFar === bestSS && td < bestDist)) {
          bestCross = crossSoFar; bestSS = ssSoFar; bestDist = td; bestAsgn = [...cur];
        }
        return;
      }
      for (const cand of edgeCandidates[depth]!) {
        if (iters > MAX_ITER) return;
        const nc = countCrossings(depth, cand);
        const totalCr = crossSoFar + nc;
        if (totalCr > bestCross) continue;
        const ol = handleCongestion(depth, cand);
        const totalSS = ssSoFar + ol;
        if (totalCr === bestCross && totalSS > bestSS) continue;
        cur[depth] = cand;
        addCounts(depth, cand);
        srch(depth + 1, totalCr, totalSS);
        removeCounts(depth, cand);
        if (bestCross === 0 && bestSS === 0) return;
      }
    }

    srch(0, 0, 0);
    return { crossings: bestCross, sameSideConflicts: bestSS, totalDist: bestDist, assignment: bestAsgn };
  }

  let candidates = buildCandidates();
  let result = optimise(candidates);
  let totalViolations = result.crossings;

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
          if (tryResult.crossings < totalViolations) {
            result = tryResult;
            candidates = tryCands;
            totalViolations = tryResult.crossings;
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

  for (let i = 0; i < validEdges.length; i++) {
    const ei = validEdges[i]!;
    for (let j = i + 1; j < validEdges.length; j++) {
      const ej = validEdges[j]!;
      if (ei.source !== ej.target || ei.target !== ej.source) continue;
      const sib = absBounds(nodeMap.get(ei.source)!), tib = absBounds(nodeMap.get(ei.target)!);
      const pt = (s: string, b: { x: number; y: number; w: number; h: number }) => handlePosPoint(b, s);
      const iSrc = ei.sourceHandle!.replace('source-', ''), iTgt = ei.targetHandle!.replace('target-', '');
      const jSrc = ej.sourceHandle!.replace('source-', ''), jTgt = ej.targetHandle!.replace('target-', '');

      function pairAngle(is: string, it: string, js: string, jt: string): number {
        if (is === it || js === jt) return -Infinity;
        const pis = pt(is, sib), pit = pt(it, tib), pjs = pt(js, tib), pjt = pt(jt, sib);
        const a1s = Math.atan2(pit.y - pis.y, pit.x - pis.x);
        const a2s = Math.atan2(pjt.y - pjs.y, pjt.x - pjs.x);
        const a1t = Math.atan2(pis.y - pit.y, pis.x - pit.x);
        const a2t = Math.atan2(pjt.y - pit.y, pjt.x - pit.x);
        let dA = Math.abs(a1s - a2s); if (dA > Math.PI) dA = 2 * Math.PI - dA;
        let dB = Math.abs(a1t - a2t); if (dB > Math.PI) dB = 2 * Math.PI - dB;
        for (let k = 0; k < validEdges.length; k++) {
          const ek = validEdges[k]!;
          if (ek === ei || ek === ej) continue;
          if (ek.source === ei.source || ek.target === ei.target || ek.source === ei.target || ek.target === ei.source) continue;
          const ks = pt(ek.sourceHandle!.replace('source-', ''), absBounds(nodeMap.get(ek.source)!));
          const kt = pt(ek.targetHandle!.replace('target-', ''), absBounds(nodeMap.get(ek.target)!));
          if (segmentsIntersect(pis, pit, ks, kt) || segmentsIntersect(pjs, pjt, ks, kt)) return -Infinity;
        }
        if (segmentsIntersect(pis, pit, pjs, pjt)) return -Infinity;
        return Math.min(dA, dB);
      }

      const curAngle = pairAngle(iSrc, iTgt, jSrc, jTgt);
      let bestAngle = curAngle, bestIT = iTgt, bestJS = jSrc;
      const tryNodeB = (it: string, js: string) => {
        const a = pairAngle(iSrc, it, js, jTgt);
        if (a > bestAngle) { bestAngle = a; bestIT = it; bestJS = js; }
      };
      tryNodeB(jSrc, iTgt);
      if (bestAngle > curAngle) {
        ei.targetHandle = `target-${bestIT}`;
        ej.sourceHandle = `source-${bestJS}`;
      }
    }
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
