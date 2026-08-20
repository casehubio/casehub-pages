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

function detectHandlePosition(
  pos: { x: number; y: number },
  peerPos: { x: number; y: number },
  direction?: string,
): string {
  const dx = peerPos.x - pos.x;
  const dy = peerPos.y - pos.y;

  // When peers are in the expected flow direction, prefer that direction
  // even if horizontal displacement is large (fan-out / fan-in)
  if (direction === 'DOWN' && dy > 0 && Math.abs(dy) > 20) return 'bottom';
  if (direction === 'DOWN' && dy < 0 && Math.abs(dy) > 20) return 'top';
  if (direction === 'RIGHT' && dx > 0 && Math.abs(dx) > 20) return 'right';
  if (direction === 'RIGHT' && dx < 0 && Math.abs(dx) > 20) return 'left';

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'bottom' : 'top';
}

function autoDetectHandleDirections(nodes: Node[], edges: Edge[], direction?: string): void {
  if (!nodes.length || !edges.length) return;
  const posMap = new Map(nodes.map(n => [n.id, n.position]));

  for (const node of nodes) {
    const pos = posMap.get(node.id);
    if (!pos) continue;

    const sourceDirs: Record<string, number> = {};
    const targetDirs: Record<string, number> = {};

    for (const e of edges) {
      if (e.source === node.id) {
        const peerPos = posMap.get(e.target);
        if (!peerPos) continue;
        const dir = detectHandlePosition(pos, peerPos, direction);
        sourceDirs[dir] = (sourceDirs[dir] ?? 0) + 1;
      } else if (e.target === node.id) {
        const peerPos = posMap.get(e.source);
        if (!peerPos) continue;
        const dir = detectHandlePosition(pos, peerPos, direction);
        targetDirs[dir] = (targetDirs[dir] ?? 0) + 1;
      }
    }

    // For fan-out/fan-in (edges going both left AND right), prefer vertical handles
    const bestDir = (dirs: Record<string, number>): string | undefined => {
      if (dirs['left'] && dirs['right']) {
        return (dirs['bottom'] ?? 0) >= (dirs['top'] ?? 0) ? 'bottom' : 'top';
      }
      let best: string | undefined;
      let max = 0;
      for (const [d, count] of Object.entries(dirs)) {
        if (count > max) { max = count; best = d; }
      }
      return best;
    };

    const updates: Record<string, unknown> = {};
    const srcBest = bestDir(sourceDirs);
    const tgtBest = bestDir(targetDirs);
    if (srcBest) updates._sourceHandlePosition = srcBest;
    if (tgtBest) updates._targetHandlePosition = tgtBest;
    if (Object.keys(updates).length > 0) {
      node.data = { ...node.data, ...updates };
    }
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
