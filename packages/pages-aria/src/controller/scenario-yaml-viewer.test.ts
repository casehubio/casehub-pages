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
});
