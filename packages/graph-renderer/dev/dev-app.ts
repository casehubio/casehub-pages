import { createGraph } from '@casehubio/graph-core';
import { registerStencil } from '../src/registry/stencil-registry.js';
import { sampleDefaultRender, sampleGroupRender } from './sample-nodes.js';
import '../src/bridge/GraphCanvas.js';

registerStencil({
  type: 'sample-default',
  label: 'Default Node',
  icon: 'circle',
  grammar: {
    type: 'sample-default',
    connections: {
      inbound: { min: 0, max: 5, allowedFrom: [] },
      outbound: { min: 0, max: 5, allowedTo: [] },
    },
  },
  render: sampleDefaultRender,
});
registerStencil({
  type: 'sample-group',
  label: 'Group Node',
  icon: 'box',
  grammar: {
    type: 'sample-group',
    connections: {
      inbound: { min: 0, max: 5, allowedFrom: [] },
      outbound: { min: 0, max: 5, allowedTo: [] },
    },
  },
  render: sampleGroupRender,
});

const model = createGraph(
  [
    { id: 'worker-1', type: 'sample-group', properties: { label: 'Worker: ReviewAgent' } },
    { id: 'binding-1', type: 'sample-default', parentId: 'worker-1', properties: { label: 'on-document-upload' } },
    { id: 'binding-2', type: 'sample-default', parentId: 'worker-1', properties: { label: 'on-review-complete' } },
    { id: 'milestone-1', type: 'sample-default', properties: { label: 'Milestone: review-done' } },
    { id: 'goal-1', type: 'sample-default', properties: { label: 'Goal: case-resolved' } },
  ],
  [
    { id: 'e1', type: 'default', source: 'binding-1', target: 'binding-2' },
    { id: 'e2', type: 'default', source: 'binding-2', target: 'milestone-1' },
    { id: 'e3', type: 'default', source: 'milestone-1', target: 'goal-1' },
  ],
);

const canvas = document.querySelector('pages-graph-canvas');
if (canvas) {
  (canvas as unknown as { model: typeof model }).model = model;
}

const hostTestEl = document.getElementById('host-test');
if (hostTestEl) {
  hostTestEl.textContent = 'This text should have HOST styles (Comic Sans, magenta) — not affected by graph-renderer CSS.';
}
