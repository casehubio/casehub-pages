import { html } from 'lit-html';
import { registerStencil } from '@casehubio/graph-renderer';
import type { GraphModel, GraphNode } from '@casehubio/graph-core';
import type { StencilRenderFn } from '@casehubio/graph-renderer';

function nodeLabel(node: GraphNode, fallback: string): string {
  const name = node.properties['name'];
  return typeof name === 'string' && name.length > 0 ? name : fallback;
}

function stencilStyle(bg: string, fg: string): string {
  return `display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 16px;min-width:100px;border-radius:8px;background:${bg};color:${fg};font-family:var(--pages-font-family,system-ui)`;
}

const renderSource: StencilRenderFn = (node) => html`
  <div style="${stencilStyle('var(--pages-success-9,#16a34a)', 'var(--pages-success-12,#fff)')}">
    <span style="font-size:20px;line-height:1">⬇</span>
    <span style="font-size:11px;margin-top:4px;white-space:nowrap">${nodeLabel(node, 'Source')}</span>
  </div>`;

const renderTransform: StencilRenderFn = (node) => html`
  <div style="${stencilStyle('var(--pages-accent-9,#5470c6)', 'var(--pages-accent-12,#fff)')}">
    <span style="font-size:20px;line-height:1">⚙</span>
    <span style="font-size:11px;margin-top:4px;white-space:nowrap">${nodeLabel(node, 'Transform')}</span>
  </div>`;

const renderFilter: StencilRenderFn = (node) => html`
  <div style="${stencilStyle('var(--pages-warning-9,#ca8a04)', 'var(--pages-warning-12,#fff)')}">
    <span style="font-size:20px;line-height:1">⧖</span>
    <span style="font-size:11px;margin-top:4px;white-space:nowrap">${nodeLabel(node, 'Filter')}</span>
  </div>`;

const renderJoin: StencilRenderFn = (node) => html`
  <div style="${stencilStyle('var(--pages-info-9,#0891b2)', 'var(--pages-info-12,#fff)')}">
    <span style="font-size:20px;line-height:1">⨝</span>
    <span style="font-size:11px;margin-top:4px;white-space:nowrap">${nodeLabel(node, 'Join')}</span>
  </div>`;

const renderSink: StencilRenderFn = (node) => html`
  <div style="${stencilStyle('var(--pages-danger-9,#dc2626)', 'var(--pages-danger-12,#fff)')}">
    <span style="font-size:20px;line-height:1">⬆</span>
    <span style="font-size:11px;margin-top:4px;white-space:nowrap">${nodeLabel(node, 'Sink')}</span>
  </div>`;

registerStencil({
  type: 'source', label: 'Source', icon: '⬇', render: renderSource,
  grammar: {
    type: 'source',
    connections: {
      inbound: { min: 0, max: 0, allowedFrom: [] },
      outbound: { min: 0, max: 2, allowedTo: ['transform', 'filter', 'join'] },
    },
  },
});

registerStencil({
  type: 'transform', label: 'Transform', icon: '⚙', render: renderTransform,
  grammar: {
    type: 'transform',
    connections: {
      inbound: { min: 0, max: 3, allowedFrom: [] },
      outbound: { min: 0, max: 2, allowedTo: ['transform', 'filter', 'join', 'sink'] },
    },
  },
});

registerStencil({
  type: 'filter', label: 'Filter', icon: '⧖', render: renderFilter,
  grammar: {
    type: 'filter',
    connections: {
      inbound: { min: 0, max: 1, allowedFrom: [] },
      outbound: { min: 0, max: 2, allowedTo: ['transform', 'filter', 'join', 'sink'] },
    },
  },
});

registerStencil({
  type: 'join', label: 'Join', icon: '⨝', render: renderJoin,
  grammar: {
    type: 'join',
    connections: {
      inbound: { min: 0, max: 4, allowedFrom: [] },
      outbound: { min: 0, max: 1, allowedTo: ['transform', 'filter', 'sink'] },
    },
  },
});

registerStencil({
  type: 'sink', label: 'Sink', icon: '⬆', render: renderSink,
  grammar: {
    type: 'sink',
    connections: {
      inbound: { min: 0, max: 2, allowedFrom: [] },
      outbound: { min: 0, max: 0, allowedTo: [] },
    },
  },
});

export function createBasicPipelineModel(): GraphModel {
  return {
    nodes: [
      { id: 'src1', type: 'source', properties: { name: 'API Source' } },
      { id: 'tx1', type: 'transform', properties: { name: 'Parse JSON' } },
      { id: 'fl1', type: 'filter', properties: { name: 'Valid Records' } },
      { id: 'sk1', type: 'sink', properties: { name: 'Database' } },
      { id: 'sk2', type: 'sink', properties: { name: 'Error Log' } },
    ],
    edges: [
      { id: 'e1', type: 'default', source: 'src1', target: 'tx1' },
      { id: 'e2', type: 'default', source: 'tx1', target: 'fl1' },
      { id: 'e3', type: 'default', source: 'fl1', target: 'sk1' },
      { id: 'e4', type: 'default', source: 'fl1', target: 'sk2' },
    ],
  };
}

export const PIPELINE_SCHEMAS: Record<string, object> = {
  source: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      url: { type: 'string', title: 'URL' },
      format: { type: 'string', title: 'Format', enum: ['json', 'csv', 'xml'] },
      pollIntervalSec: { type: 'number', title: 'Poll Interval (sec)', minimum: 1 },
    },
    required: ['name'],
  },
  transform: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      expression: { type: 'string', title: 'Expression' },
      language: { type: 'string', title: 'Language', enum: ['jsonata', 'jq', 'javascript'] },
    },
    required: ['name'],
  },
  filter: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      condition: { type: 'string', title: 'Condition' },
      passLabel: { type: 'string', title: 'Pass Label' },
      failLabel: { type: 'string', title: 'Fail Label' },
    },
    required: ['name'],
  },
  join: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      strategy: { type: 'string', title: 'Strategy', enum: ['merge', 'zip', 'concat'] },
      windowMs: { type: 'number', title: 'Window (ms)', minimum: 0 },
    },
    required: ['name'],
  },
  sink: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      url: { type: 'string', title: 'URL' },
      format: { type: 'string', title: 'Format', enum: ['json', 'csv'] },
      batchSize: { type: 'number', title: 'Batch Size', minimum: 1 },
    },
    required: ['name'],
  },
};
