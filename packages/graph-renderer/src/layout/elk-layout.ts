import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';

export interface ElkLayoutOptions {
  direction?: 'DOWN' | 'RIGHT' | 'LEFT' | 'UP';
  spacing?: number;
}

const DEFAULT_NODE_WIDTH = 172;
const DEFAULT_NODE_HEIGHT = 36;

const elk = new ELK();

export async function computeElkLayout(
  nodes: Node[],
  edges: Edge[],
  options: ElkLayoutOptions = {},
): Promise<Node[]> {
  const direction = options.direction ?? 'DOWN';
  const spacing = options.spacing ?? 50;

  const rootChildren: ElkNode[] = [];
  const childrenMap = new Map<string, ElkNode[]>();

  for (const node of nodes) {
    const elkNode: ElkNode = {
      id: node.id,
      width: (node.measured?.width as number | undefined) ?? (node.style?.width as number | undefined) ?? DEFAULT_NODE_WIDTH,
      height: (node.measured?.height as number | undefined) ?? (node.style?.height as number | undefined) ?? DEFAULT_NODE_HEIGHT,
    };

    if (node.parentId) {
      const siblings = childrenMap.get(node.parentId) ?? [];
      siblings.push(elkNode);
      childrenMap.set(node.parentId, siblings);
    } else {
      rootChildren.push(elkNode);
    }
  }

  for (const elkNode of [...rootChildren, ...Array.from(childrenMap.values()).flat()]) {
    const children = childrenMap.get(elkNode.id);
    if (children) {
      elkNode.children = children;
      elkNode.layoutOptions = { 'elk.hierarchyHandling': 'INCLUDE_CHILDREN' };
    }
  }

  const elkEdges: ElkExtendedEdge[] = edges.map(e => ({
    id: e.id,
    sources: [e.source],
    targets: [e.target],
  }));

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': String(spacing),
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: rootChildren,
    edges: elkEdges,
  };

  const layouted = await elk.layout(graph);

  const positionMap = new Map<string, { x: number; y: number }>();
  function extractPositions(elkNodes: ElkNode[] | undefined): void {
    if (!elkNodes) return;
    for (const n of elkNodes) {
      positionMap.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
      extractPositions(n.children);
    }
  }
  extractPositions(layouted.children);

  return nodes.map(node => ({
    ...node,
    position: positionMap.get(node.id) ?? node.position,
  }));
}
