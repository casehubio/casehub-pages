import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { GraphModel, GraphNode } from '@casehubio/graph-core';
import { rootNodes, childrenOf } from '@casehubio/graph-core';

export interface ElkLayoutOptions {
  direction?: 'DOWN' | 'RIGHT' | 'LEFT' | 'UP';
  spacing?: number;
  containerPadding?: number;
  nodeSizes?: ReadonlyMap<string, { width: number; height: number }>;
  wrapping?: boolean;
}

export interface NodeLayout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ElkLayoutResult {
  readonly nodeLayouts: ReadonlyMap<string, NodeLayout>;
}

const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 50;
const DEFAULT_HEADER_HEIGHT = 35;

const CHAR_WIDTH = 7.5;
const LABEL_PADDING = 40;

function estimateNodeWidth(node: GraphNode): number {
  const label = (node.properties['label'] ?? node.properties['taskDescription'] ?? '') as string;
  if (!label) return DEFAULT_NODE_WIDTH;
  return Math.max(DEFAULT_NODE_WIDTH, Math.ceil(label.length * CHAR_WIDTH + LABEL_PADDING));
}

const elk = new ELK();

function buildElkNode(
  model: GraphModel,
  node: GraphNode,
  visited: Set<string>,
  padding: number,
  nodeSizes?: ReadonlyMap<string, { width: number; height: number }>,
  wrapping?: boolean,
): ElkNode {
  if (visited.has(node.id)) {
    throw new Error(`Containment cycle at node '${node.id}'`);
  }
  visited.add(node.id);

  const children = childrenOf(model, node.id);
  const size = nodeSizes?.get(node.id);
  const estimatedWidth = estimateNodeWidth(node);
  const elkNode: ElkNode = {
    id: node.id,
    width: size?.width ?? estimatedWidth,
    height: size?.height ?? DEFAULT_NODE_HEIGHT,
  };
  if (children.length > 0) {
    elkNode.children = children.map(c => buildElkNode(model, c, visited, padding, nodeSizes, wrapping));
    const containerOpts: Record<string, string> = {
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.padding': `[top=${Math.max(padding, DEFAULT_HEADER_HEIGHT)},left=${padding},bottom=${padding},right=${padding}]`,
    };
    if (wrapping) {
      containerOpts['elk.layered.wrapping.strategy'] = 'SINGLE_EDGE';
      containerOpts['elk.layered.wrapping.cutting.strategy'] = 'ARD';
      containerOpts['elk.aspectRatio'] = '1.6';
    }
    elkNode.layoutOptions = containerOpts;
  }
  return elkNode;
}

function extractNodeLayouts(elkNodes: ElkNode[] | undefined, map: Map<string, NodeLayout>): void {
  if (!elkNodes) return;
  for (const n of elkNodes) {
    map.set(n.id, {
      x: n.x ?? 0,
      y: n.y ?? 0,
      width: n.width ?? DEFAULT_NODE_WIDTH,
      height: n.height ?? DEFAULT_NODE_HEIGHT,
    });
    extractNodeLayouts(n.children, map);
  }
}

export async function computeElkLayout(
  model: GraphModel,
  options: ElkLayoutOptions = {},
): Promise<ElkLayoutResult> {
  const direction = options.direction ?? 'DOWN';
  const spacing = options.spacing ?? 50;
  const padding = options.containerPadding ?? 20;

  const roots = rootNodes(model);
  if (roots.length === 0) {
    if (model.nodes.length > 0) {
      throw new Error('Containment cycle: no root nodes found — every node has a parent');
    }
    return { nodeLayouts: new Map() };
  }

  const nodeSizes = options.nodeSizes;
  const rootChildren = roots.map(n => buildElkNode(model, n, new Set(), padding, nodeSizes, options.wrapping));

  const elkEdges: ElkExtendedEdge[] = model.edges.map(e => ({
    id: e.id,
    sources: [e.source],
    targets: [e.target],
  }));

  const layoutOpts: Record<string, string> = {
    'elk.algorithm': 'layered',
    'elk.direction': direction,
    'elk.spacing.nodeNode': String(spacing),
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  };

  if (options.wrapping) {
    layoutOpts['elk.layered.wrapping.strategy'] = 'SINGLE_EDGE';
    layoutOpts['elk.layered.wrapping.additionalEdgeSpacing'] = '30';
    layoutOpts['elk.aspectRatio'] = '1.6';
    layoutOpts['elk.layered.wrapping.cutting.strategy'] = 'ARD';
  }

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: layoutOpts,
    children: rootChildren,
    edges: elkEdges,
  };

  const layouted = await elk.layout(graph);

  const nodeLayouts = new Map<string, NodeLayout>();
  extractNodeLayouts(layouted.children, nodeLayouts);

  if (options.wrapping && (direction === 'RIGHT' || direction === 'LEFT')) {
    snakeReverseAlternateRows(nodeLayouts, model);
  }

  return { nodeLayouts };
}

function snakeReverseAlternateRows(layouts: Map<string, NodeLayout>, model: GraphModel): void {
  const parentGroups = new Map<string, string[]>();
  for (const node of model.nodes) {
    const key = node.parentId ?? '__root__';
    const group = parentGroups.get(key) ?? [];
    group.push(node.id);
    parentGroups.set(key, group);
  }

  for (const ids of parentGroups.values()) {
    const withLayout = ids.map(id => ({ id, layout: layouts.get(id) })).filter(n => n.layout);
    if (withLayout.length < 2) continue;

    const rowMap = new Map<number, typeof withLayout>();
    for (const n of withLayout) {
      const y = Math.round(n.layout!.y);
      const row = [...rowMap.keys()].find(k => Math.abs(k - y) < 10) ?? y;
      const arr = rowMap.get(row) ?? [];
      arr.push(n);
      rowMap.set(row, arr);
    }

    if (rowMap.size < 2) continue;
    const sortedRows = [...rowMap.entries()].sort((a, b) => a[0] - b[0]);

    let minX = Infinity, maxXRight = -Infinity;
    for (const n of withLayout) {
      minX = Math.min(minX, n.layout!.x);
      maxXRight = Math.max(maxXRight, n.layout!.x + n.layout!.width);
    }

    for (let i = 1; i < sortedRows.length; i += 2) {
      const row = sortedRows[i]![1];
      for (const n of row) {
        const l = n.layout!;
        const newX = minX + (maxXRight - (l.x + l.width));
        layouts.set(n.id, { x: newX, y: l.y, width: l.width, height: l.height });
      }
    }
  }
}
