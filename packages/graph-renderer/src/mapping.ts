import type { GraphNode, GraphEdge, GraphModel } from '@casehubio/graph-core';
import type { Node, Edge } from '@xyflow/react';
import type { NodeLayout, ElkLayoutResult } from './layout/elk-layout.js';

const DEFAULT_PARENT_WIDTH = 280;
const DEFAULT_PARENT_HEIGHT = 180;

export function toReactFlowNode(
  node: GraphNode,
  parentIds: ReadonlySet<string>,
  nodeLayout?: NodeLayout,
): Node {
  const rfNode: Node = {
    id: node.id,
    type: node.type,
    position: nodeLayout
      ? { x: nodeLayout.x, y: nodeLayout.y }
      : { x: 0, y: 0 },
    data: { ...node.properties },
  };

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

export function toReactFlowGraph(
  model: GraphModel,
  layout?: ElkLayoutResult,
): { nodes: Node[]; edges: Edge[] } {
  const parentIds = new Set<string>();
  for (const node of model.nodes) {
    if (node.parentId) {
      parentIds.add(node.parentId);
    }
  }

  return {
    nodes: model.nodes.map(n =>
      toReactFlowNode(n, parentIds, layout?.nodeLayouts.get(n.id)),
    ),
    edges: model.edges.map(e => toReactFlowEdge(e)),
  };
}
