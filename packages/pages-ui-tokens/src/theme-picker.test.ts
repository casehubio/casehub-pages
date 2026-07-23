import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { registerTheme, applyTheme, _resetAppliedThemes } from './runtime.js';

beforeAll(async () => {
  registerTheme('default-light', '.pages-theme-default-light {}');
  registerTheme('default-dark', '.pages-theme-default-dark {}');
  registerTheme('casehub-light', '.pages-theme-casehub-light {}');
  registerTheme('casehub-dark', '.pages-theme-casehub-dark {}');
  applyTheme('default-dark');
  await import('./theme-picker.js');
});

describe('pages-theme-picker', () => {
  let picker: HTMLElement;

  beforeEach(async () => {
    _resetAppliedThemes();
    document.body.innerHTML = '';
    registerTheme('default-light', '.pages-theme-default-light {}');
    registerTheme('default-dark', '.pages-theme-default-dark {}');
    registerTheme('casehub-light', '.pages-theme-casehub-light {}');
    registerTheme('casehub-dark', '.pages-theme-casehub-dark {}');
    applyTheme('default-dark');
    picker = document.createElement('pages-theme-picker');
    document.body.appendChild(picker);
    await (picker as any).updateComplete;
  });

  it('is a defined custom element', () => {
    expect(customElements.get('pages-theme-picker')).toBeDefined();
  });

  it('renders a shadow root', () => {
    expect(picker.shadowRoot).not.toBeNull();
  });

  it('renders a select dropdown', () => {
    const select = picker.shadowRoot?.querySelector('select');
    expect(select).not.toBeNull();
  });

  it('groups themes by family', () => {
    const select = picker.shadowRoot?.querySelector('select');
    const options = Array.from(select?.querySelectorAll('option') ?? []);
    const labels = options.map(o => o.textContent);
    expect(labels).toContain('Default');
    expect(labels).toContain('Casehub');
  });

  it('has light/dark mode toggle buttons', () => {
    const buttons = picker.shadowRoot?.querySelectorAll('button');
    expect(buttons?.length).toBeGreaterThanOrEqual(2);
  });
});
