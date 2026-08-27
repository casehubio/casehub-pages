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
      outbound: { min: 0, max: 10, allowedTo: ['transform', 'filter', 'join'] },
    },
  },
});

registerStencil({
  type: 'transform', label: 'Transform', icon: '⚙', render: renderTransform,
  grammar: {
    type: 'transform',
    connections: {
      inbound: { min: 0, max: 10, allowedFrom: [] },
      outbound: { min: 0, max: 10, allowedTo: ['transform', 'filter', 'join', 'sink'] },
    },
  },
});

registerStencil({
  type: 'filter', label: 'Filter', icon: '⧖', render: renderFilter,
  grammar: {
    type: 'filter',
    connections: {
      inbound: { min: 0, max: 10, allowedFrom: [] },
      outbound: { min: 0, max: 10, allowedTo: ['transform', 'filter', 'join', 'sink'] },
    },
  },
});

registerStencil({
  type: 'join', label: 'Join', icon: '⨝', render: renderJoin,
  grammar: {
    type: 'join',
    connections: {
      inbound: { min: 0, max: 10, allowedFrom: [] },
      outbound: { min: 0, max: 10, allowedTo: ['transform', 'filter', 'sink'] },
    },
  },
});

registerStencil({
  type: 'sink', label: 'Sink', icon: '⬆', render: renderSink,
  grammar: {
    type: 'sink',
    connections: {
      inbound: { min: 0, max: 10, allowedFrom: [] },
      outbound: { min: 0, max: 0, allowedTo: [] },
    },
  },
});

export function createBasicPipelineModel(): GraphModel {
  return {
    nodes: [
      { id: 'src1', type: 'source', properties: {
        name: 'API Source', url: 'https://api.example.com/data', format: 'json',
        pollInterval: 'PT30S', startDate: '2026-08-01', tags: ['production', 'rest-api'], enabled: true,
      } },
      { id: 'tx1', type: 'transform', properties: {
        name: 'Parse JSON', expression: '$.data[*].{\n  id: id,\n  value: metrics.total\n}',
        language: 'jsonata', timeout: 'PT5S', color: '#5470c6',
      } },
      { id: 'fl1', type: 'filter', properties: {
        name: 'Valid Records', condition: '$.status != "invalid" && $.value > 0',
        threshold: 75, caseSensitive: false,
        categories: ['critical', 'warning'],
      } },
      { id: 'sk1', type: 'sink', properties: {
        name: 'Database', url: 'jdbc:postgresql://db/pipeline', format: 'json',
        batchSize: 100, retryDelay: 'PT10S', lastExport: '2026-08-27T14:30:00Z',
        tags: ['postgres', 'primary'], description: 'Main database sink for validated pipeline records.',
      } },
      { id: 'sk2', type: 'sink', properties: {
        name: 'Error Log', url: 'file:///var/log/errors.json', format: 'csv',
        batchSize: 1, retryDelay: 'PT1S', lastExport: '2026-08-27T14:28:00Z',
        tags: ['logging', 'errors'], description: 'Captures rejected records for review.',
      } },
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
      url: { type: 'string', title: 'Endpoint URL', format: 'uri' },
      format: { type: 'string', title: 'Format', enum: ['json', 'csv', 'xml'] },
      pollInterval: { type: 'string', title: 'Poll Interval', format: 'duration' },
      startDate: { type: 'string', title: 'Active Since', format: 'date' },
      tags: { type: 'array', title: 'Tags', items: { type: 'string' } },
      enabled: { type: 'boolean', title: 'Enabled' },
    },
    required: ['name', 'url'],
  },
  transform: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      expression: { type: 'string', title: 'Expression', 'x-display-hint': 'textarea' },
      language: { type: 'string', title: 'Language', enum: ['jsonata', 'jq', 'javascript'] },
      timeout: { type: 'string', title: 'Timeout', format: 'duration' },
      color: { type: 'string', title: 'Node Color', format: 'color' },
    },
    required: ['name', 'expression'],
  },
  filter: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      condition: { type: 'string', title: 'Condition', 'x-display-hint': 'textarea' },
      threshold: { type: 'number', title: 'Pass Threshold (%)', minimum: 0, maximum: 100, 'x-display-hint': 'slider' },
      caseSensitive: { type: 'boolean', title: 'Case Sensitive' },
      categories: { type: 'array', title: 'Alert Categories', items: { type: 'string', enum: ['critical', 'warning', 'info', 'debug'] } },
    },
    required: ['name', 'condition'],
  },
  join: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      strategy: { type: 'string', title: 'Strategy', enum: ['merge', 'zip', 'concat'] },
      windowMs: { type: 'number', title: 'Window (ms)', minimum: 0, maximum: 30000, 'x-display-hint': 'slider' },
      color: { type: 'string', title: 'Node Color', format: 'color' },
    },
    required: ['name'],
  },
  sink: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      url: { type: 'string', title: 'Destination URL', format: 'uri' },
      format: { type: 'string', title: 'Format', enum: ['json', 'csv'] },
      batchSize: { type: 'number', title: 'Batch Size', minimum: 1 },
      retryDelay: { type: 'string', title: 'Retry Delay', format: 'duration' },
      lastExport: { type: 'string', title: 'Last Export', format: 'date-time' },
      tags: { type: 'array', title: 'Tags', items: { type: 'string' } },
      description: { type: 'string', title: 'Description', 'x-display-hint': 'textarea' },
    },
    required: ['name', 'url'],
  },
};
