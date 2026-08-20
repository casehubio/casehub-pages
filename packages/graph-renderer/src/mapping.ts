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

function autoDetectHandleDirections(nodes: Node[], edges: Edge[]): void {
  if (!nodes.length || !edges.length) return;
  const posMap = new Map(nodes.map(n => [n.id, n.position]));

  for (const node of nodes) {
    const pos = posMap.get(node.id);
    if (!pos) continue;

    let sourceH = 0, sourceV = 0, targetH = 0, targetV = 0;
    for (const e of edges) {
      if (e.source === node.id) {
        const peerPos = posMap.get(e.target);
        if (!peerPos) continue;
        if (Math.abs(peerPos.x - pos.x) > Math.abs(peerPos.y - pos.y)) sourceH++;
        else sourceV++;
      } else if (e.target === node.id) {
        const peerPos = posMap.get(e.source);
        if (!peerPos) continue;
        if (Math.abs(peerPos.x - pos.x) > Math.abs(peerPos.y - pos.y)) targetH++;
        else targetV++;
      }
    }

    const updates: Record<string, unknown> = {};
    if (sourceH > 0 || sourceV > 0) {
      updates._sourceHandleDirection = sourceH > sourceV ? 'horizontal' : undefined;
    }
    if (targetH > 0 || targetV > 0) {
      updates._targetHandleDirection = targetH > targetV ? 'horizontal' : undefined;
    }
    if (Object.keys(updates).length > 0) {
      node.data = { ...node.data, ...updates };
    }
  }
}

export function toReactFlowGraph(
  model: GraphModel,
  layout?: ElkLayoutResult,
  decorations?: ReadonlyMap<string, NodeDecoration>,
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
    autoDetectHandleDirections(nodes, edges);
  }

  return { nodes, edges };
}
