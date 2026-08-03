import { createGraph } from '@casehubio/graph-core';
import { registerNodeType } from '../src/registry/node-registry.js';
import { createStencilNodeComponent } from '../src/stencil-wrapper.js';
import { sampleDefaultRender, sampleGroupRender } from './sample-nodes.js';
import '../src/bridge/GraphCanvas.js';

registerNodeType({ type: 'sample-default', component: createStencilNodeComponent(sampleDefaultRender) });
registerNodeType({ type: 'sample-group', component: createStencilNodeComponent(sampleGroupRender) });

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
