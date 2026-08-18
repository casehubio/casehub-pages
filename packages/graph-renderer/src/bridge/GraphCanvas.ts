import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Node, Edge } from '@xyflow/react';
import type { GraphModel } from '@casehubio/graph-core';
import { applyTheme, getTheme } from '@casehubio/pages-ui-tokens';
import { ReactFlowApp } from './ReactFlowApp.js';
import { getNodeTypes } from '../registry/stencil-registry.js';
import { injectIsolationStyles, releaseIsolationStyles, DIAGRAM_ROOT_CLASS } from './css-isolation.js';
import { emitPagesEvent } from '@casehubio/pages-data';
import { toReactFlowGraph } from '../mapping.js';
import { computeElkLayout, type ElkLayoutOptions } from '../layout/elk-layout.js';

@customElement('pages-graph-canvas')
export class GraphCanvas extends LitElement {
  @property({ attribute: false }) model: GraphModel | undefined;
  @property({ attribute: false }) layoutOptions: ElkLayoutOptions | undefined;

  @state() private _nodes: Node[] = [];
  @state() private _edges: Edge[] = [];

  private _root: Root | undefined;
  private _container: HTMLDivElement | undefined;
  private _themeListener: ((e: Event) => void) | undefined;
  private _layoutGeneration = 0;

  override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();

    this._container = document.createElement('div');
    this._container.classList.add(DIAGRAM_ROOT_CLASS);

    injectIsolationStyles(this);

    const currentTheme = getTheme(document.documentElement) || 'default-light';
    applyTheme(currentTheme, this._container);

    this.appendChild(this._container);

    this._root = createRoot(this._container);
    this._renderReact();

    this._themeListener = (e: Event) => {
      if (e.target === document.documentElement && this._container) {
        const detail = (e as CustomEvent<{ name: string }>).detail;
        applyTheme(detail.name, this._container);
      }
    };
    document.documentElement.addEventListener('pages-theme-change', this._themeListener);
  }

  override disconnectedCallback(): void {
    if (this._themeListener) {
      document.documentElement.removeEventListener('pages-theme-change', this._themeListener);
      this._themeListener = undefined;
    }
    this._root?.unmount();
    this._root = undefined;
    this._container?.remove();
    this._container = undefined;
    releaseIsolationStyles(this);
    super.disconnectedCallback();
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('model') || changed.has('layoutOptions')) {
      void this._runLayout();
    }
    this._renderReact();
  }

  private async _runLayout(): Promise<void> {
    const model = this.model;
    if (!model) {
      this._nodes = [];
      this._edges = [];
      return;
    }

    const generation = ++this._layoutGeneration;

    try {
      const layout = await computeElkLayout(model, this.layoutOptions);
      if (generation !== this._layoutGeneration) return;
      const { nodes, edges } = toReactFlowGraph(model, layout);
      this._nodes = nodes;
      this._edges = edges;
    } catch (err) {
      if (generation !== this._layoutGeneration) return;
      const { nodes, edges } = toReactFlowGraph(model);
      this._nodes = nodes;
      this._edges = edges;
      emitPagesEvent(this, 'graph:layout:error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private _renderReact(): void {
    if (!this._root) return;

    this._root.render(
      createElement(ReactFlowApp, {
        nodes: this._nodes,
        edges: this._edges,
        nodeTypes: getNodeTypes(),
        onNodeClick: (nodeId: string, node: Node) => {
          emitPagesEvent(this, 'graph:node:click', {
            nodeId,
            nodeType: node.type ?? '',
          });
        },
        onEdgeClick: (edgeId: string, edge: Edge) => {
          emitPagesEvent(this, 'graph:edge:click', {
            edgeId,
            edgeType: edge.type ?? '',
          });
        },
        onSelectionChange: (nodes: Node[], edges: Edge[]) => {
          emitPagesEvent(this, 'graph:selection:change', {
            nodeIds: nodes.map(n => n.id),
            edgeIds: edges.map(e => e.id),
          });
        },
        onViewportChange: (viewport: { x: number; y: number; zoom: number }) => {
          emitPagesEvent(this, 'graph:viewport:change', viewport);
        },
        onRelayout: () => {
          emitPagesEvent(this, 'graph:layout:relayout', {});
          void this._runLayout();
        },
      }),
    );
  }
}
