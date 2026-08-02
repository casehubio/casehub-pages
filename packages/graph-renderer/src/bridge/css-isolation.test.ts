import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getIsolationCSS,
  injectIsolationStyles,
  DIAGRAM_ROOT_CLASS,
} from './css-isolation.js';
import { clearRegistry, registerNodeType } from '../registry/node-registry.js';

describe('css-isolation', () => {
  beforeEach(() => {
    clearRegistry();
  });

  afterEach(() => {
    document.head.querySelectorAll('style[data-graph-isolation]')
      .forEach(el => el.remove());
  });

  it('generates isolation CSS with diagram-root reset', () => {
    const css = getIsolationCSS();
    expect(css).toContain(`.${DIAGRAM_ROOT_CLASS}`);
    expect(css).toContain('all: initial');
  });

  it('generates scoped revert for children', () => {
    const css = getIsolationCSS();
    expect(css).toContain(`.${DIAGRAM_ROOT_CLASS} *`);
    expect(css).toContain('all: revert');
  });

  it('includes plugin styles in isolation CSS', () => {
    registerNodeType({
      type: 'custom',
      component: () => null,
      defaultStyle: '.custom-node { background: red; }',
    });
    const css = getIsolationCSS();
    expect(css).toContain('.custom-node { background: red; }');
  });

  it('injects a style element into document.head', () => {
    const style = injectIsolationStyles();
    expect(style.parentElement).toBe(document.head);
    expect(style.hasAttribute('data-graph-isolation')).toBe(true);
  });

  it('exports DIAGRAM_ROOT_CLASS as diagram-root', () => {
    expect(DIAGRAM_ROOT_CLASS).toBe('diagram-root');
  });
});
