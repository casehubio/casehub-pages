import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Node, Edge } from '@xyflow/react';
import { applyTheme, getTheme } from '@casehubio/pages-ui-tokens';
import { ReactFlowApp } from './ReactFlowApp.js';
import { getNodeTypes } from '../registry/node-registry.js';
import { injectIsolationStyles, DIAGRAM_ROOT_CLASS } from './css-isolation.js';
import { emitPagesEvent } from '@casehubio/pages-data';

@customElement('pages-graph-canvas')
export class GraphCanvas extends LitElement {
  @property({ attribute: false }) nodes: Node[] = [];
  @property({ attribute: false }) edges: Edge[] = [];

  private _root: Root | undefined;
  private _container: HTMLDivElement | undefined;
  private _themeListener: ((e: Event) => void) | undefined;

  override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();

    this._container = document.createElement('div');
    this._container.classList.add(DIAGRAM_ROOT_CLASS);

    injectIsolationStyles();

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
    super.disconnectedCallback();
  }

  override updated(): void {
    this._renderReact();
  }

  private _renderReact(): void {
    if (!this._root) return;

    this._root.render(
      createElement(ReactFlowApp, {
        nodes: this.nodes,
        edges: this.edges,
        nodeTypes: getNodeTypes(),
        onNodeClick: (nodeId: string) => {
          emitPagesEvent(this, 'graph:node-click', { nodeId });
        },
        onSelectionChange: (nodes: Node[]) => {
          emitPagesEvent(this, 'graph:selection-change', {
            nodeIds: nodes.map(n => n.id),
          });
        },
      }),
    );
  }
}
