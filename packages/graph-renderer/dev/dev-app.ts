import { registerNodeType } from '../src/registry/node-registry.js';
import { computeElkLayout } from '../src/layout/elk-layout.js';
import { SampleDefaultNode, SampleGroupNode } from './sample-nodes.js';
import '../src/bridge/GraphCanvas.js';
import type { Node, Edge } from '@xyflow/react';

registerNodeType({ type: 'sample-default', component: SampleDefaultNode });
registerNodeType({ type: 'sample-group', component: SampleGroupNode });

const nodes: Node[] = [
  { id: 'worker-1', type: 'sample-group', position: { x: 0, y: 0 }, data: { label: 'Worker: ReviewAgent' }, style: { width: 280, height: 180 } },
  { id: 'binding-1', type: 'sample-default', position: { x: 20, y: 50 }, data: { label: 'on-document-upload' }, parentId: 'worker-1' },
  { id: 'binding-2', type: 'sample-default', position: { x: 20, y: 110 }, data: { label: 'on-review-complete' }, parentId: 'worker-1' },
  { id: 'milestone-1', type: 'sample-default', position: { x: 350, y: 50 }, data: { label: 'Milestone: review-done' } },
  { id: 'goal-1', type: 'sample-default', position: { x: 550, y: 50 }, data: { label: 'Goal: case-resolved' } },
];

const edges: Edge[] = [
  { id: 'e1', source: 'binding-1', target: 'binding-2', animated: true },
  { id: 'e2', source: 'binding-2', target: 'milestone-1' },
  { id: 'e3', source: 'milestone-1', target: 'goal-1' },
];

const canvas = document.querySelector('pages-graph-canvas');
if (canvas) {
  const typedCanvas = canvas as unknown as { nodes: Node[]; edges: Edge[] };
  typedCanvas.edges = edges;
  computeElkLayout(nodes, edges).then(layouted => {
    typedCanvas.nodes = layouted;
  }).catch(() => {
    typedCanvas.nodes = nodes;
  });
}

const hostTestEl = document.getElementById('host-test');
if (hostTestEl) {
  hostTestEl.textContent = 'This text should have HOST styles (Comic Sans, magenta) — not affected by graph-renderer CSS.';
}
