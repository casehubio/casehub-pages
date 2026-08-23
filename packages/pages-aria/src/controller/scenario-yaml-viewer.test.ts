import { describe, it, expect } from 'vitest';
import './scenario-yaml-viewer.js';

describe('PagesScenarioYamlViewer', () => {
  it('is defined as a custom element', () => {
    expect(customElements.get('pages-scenario-yaml-viewer')).toBeDefined();
  });

  it('renders empty state when no scenario', async () => {
    const el = document.createElement('pages-scenario-yaml-viewer');
    document.body.appendChild(el);
    await (el as any).updateComplete;
    const shadow = el.shadowRoot!;
    expect(shadow.querySelector('.yaml-empty')).not.toBeNull();
    document.body.removeChild(el);
  });

  it('has scenario property', () => {
    const el = document.createElement('pages-scenario-yaml-viewer') as any;
    el.scenario = 'help-desk-demo';
    expect(el.scenario).toBe('help-desk-demo');
  });

  it('yaml lines use pre-wrap for text wrapping', async () => {
    const el = document.createElement('pages-scenario-yaml-viewer') as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const styles = el.shadowRoot!.adoptedStyleSheets?.[0]
      ?? el.shadowRoot!.querySelector('style');
    const cssText = styles instanceof CSSStyleSheet
      ? Array.from(styles.cssRules).map(r => r.cssText).join('\n')
      : (styles as HTMLStyleElement)?.textContent ?? '';
    expect(cssText).toContain('pre-wrap');
    el.remove();
  });

  it('renders in standalone mode filling container', async () => {
    const el = document.createElement('pages-scenario-yaml-viewer') as any;
    el.setAttribute('mode', 'standalone');
    document.body.appendChild(el);
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector('.viewer-card');
    expect(card).not.toBeNull();
    el.remove();
  });
});
