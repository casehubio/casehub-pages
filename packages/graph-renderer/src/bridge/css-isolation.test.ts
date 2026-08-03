import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getIsolationCSS,
  injectIsolationStyles,
  releaseIsolationStyles,
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
    releaseIsolationStyles();
  });

  it('exports DIAGRAM_ROOT_CLASS as diagram-root', () => {
    expect(DIAGRAM_ROOT_CLASS).toBe('diagram-root');
  });

  describe('reference counting', () => {
    it('second mount reuses the same style element', () => {
      const first = injectIsolationStyles();
      const second = injectIsolationStyles();
      expect(second).toBe(first);
      expect(document.head.querySelectorAll('style[data-graph-isolation]').length).toBe(1);
      releaseIsolationStyles();
      releaseIsolationStyles();
    });

    it('first release keeps style when another instance is still mounted', () => {
      injectIsolationStyles();
      injectIsolationStyles();
      releaseIsolationStyles();
      const remaining = document.head.querySelector('style[data-graph-isolation]');
      expect(remaining).not.toBeNull();
      releaseIsolationStyles();
    });

    it('last release removes the style element', () => {
      injectIsolationStyles();
      injectIsolationStyles();
      releaseIsolationStyles();
      releaseIsolationStyles();
      const remaining = document.head.querySelector('style[data-graph-isolation]');
      expect(remaining).toBeNull();
    });

    it('re-mount after full cleanup creates a fresh style element', () => {
      const first = injectIsolationStyles();
      releaseIsolationStyles();
      expect(document.head.querySelector('style[data-graph-isolation]')).toBeNull();

      const second = injectIsolationStyles();
      expect(second.parentElement).toBe(document.head);
      expect(second).not.toBe(first);
      releaseIsolationStyles();
    });

    it('release with no prior inject is a no-op', () => {
      expect(() => releaseIsolationStyles()).not.toThrow();
      expect(document.head.querySelector('style[data-graph-isolation]')).toBeNull();
    });
  });
});
