import { describe, it, expect } from 'vitest';
import { LitElement } from 'lit';
import { DiagramBaseMixin } from './diagram-base-mixin.js';
import type { LayoutResult } from './diagram-base-mixin.js';
import type { GraphModel } from '@casehubio/graph-core';
import type { ElkLayoutOptions } from '@casehubio/graph-renderer';

const tagCounter = { n: 0 };
function uniqueTag() { return `test-diagram-${++tagCounter.n}`; }

class TestDiagram extends DiagramBaseMixin(LitElement) {
  computeLayoutCalls: Array<{ model: GraphModel; options: ElkLayoutOptions }> = [];

  protected _adaptYaml(_yaml: string) {
    return {
      model: { nodes: [], edges: [] } as GraphModel,
      yamlPaths: new Map<string, readonly (string | number)[]>(),
    };
  }

  protected _applyPropertyEdit() { return ''; }
  protected _emptyTemplate() { return null; }

  protected override async _computeLayout(
    model: GraphModel,
    options: ElkLayoutOptions,
  ): Promise<LayoutResult> {
    this.computeLayoutCalls.push({ model, options });
    return { layout: { nodeLayouts: new Map() }, direction: 'DOWN' };
  }
}

describe('DiagramBaseMixin', () => {
  it('exports the mixin function', () => {
    expect(typeof DiagramBaseMixin).toBe('function');
  });

  describe('_computeLayout', () => {
    it('is called by _fullRender instead of computeElkLayout directly', async () => {
      customElements.define(uniqueTag(), TestDiagram);
      const el = new TestDiagram();
      await el._fullRender('test: yaml');
      expect(el.computeLayoutCalls.length).toBe(1);
      expect(el.computeLayoutCalls[0]!.model).toEqual({ nodes: [], edges: [] });
    });
  });

  describe('_postLayout', () => {
    it('is called after toReactFlowGraph in _fullRender', async () => {
      class PostLayoutDiagram extends TestDiagram {
        postLayoutCalled = false;
        protected override _postLayout(
          nodes: import('@xyflow/react').Node[],
          edges: import('@xyflow/react').Edge[],
        ) {
          this.postLayoutCalled = true;
          return { nodes, edges };
        }
      }
      customElements.define(uniqueTag(), PostLayoutDiagram);
      const el = new PostLayoutDiagram();
      await el._fullRender('test: yaml');
      expect(el.postLayoutCalled).toBe(true);
    });

    it('is called after toReactFlowGraph in _updateWithoutLayout', async () => {
      class PostLayoutDiagram2 extends TestDiagram {
        postLayoutCalled = false;
        protected override _postLayout(
          nodes: import('@xyflow/react').Node[],
          edges: import('@xyflow/react').Edge[],
        ) {
          this.postLayoutCalled = true;
          return { nodes, edges };
        }
      }
      customElements.define(uniqueTag(), PostLayoutDiagram2);
      const el = new PostLayoutDiagram2();
      await el._fullRender('test: yaml');
      el.postLayoutCalled = false;
      el._updateWithoutLayout('test: yaml');
      expect(el.postLayoutCalled).toBe(true);
    });
  });
});
