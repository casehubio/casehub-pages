import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LiveRegionMixin } from './live-region.js';

@customElement('test-live-region')
class TestLiveRegion extends LiveRegionMixin(LitElement) {
  override render() {
    return html`<div>Test Component</div>`;
  }
}

describe('LiveRegionMixin', () => {
  let el: TestLiveRegion;

  beforeEach(async () => {
    el = document.createElement('test-live-region') as TestLiveRegion;
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.remove();
    // Clean up any orphaned live regions
    document.querySelectorAll('[aria-live]').forEach((region) => {
      if (region.getAttribute('role') === 'status') {
        region.remove();
      }
    });
  });

  it('announce() creates aria-live region in DOM', () => {
    el.announce('Test message');

    const liveRegion = document.querySelector('[aria-live]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.textContent).toBe('Test message');
  });

  it('default priority is polite', () => {
    el.announce('Test message');

    const liveRegion = document.querySelector('[aria-live]');
    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
  });

  it('announce() with assertive priority sets aria-live=assertive', () => {
    el.announce('Urgent message', 'assertive');

    const liveRegion = document.querySelector('[aria-live]');
    expect(liveRegion?.getAttribute('aria-live')).toBe('assertive');
  });

  it('live region has correct ARIA attributes', () => {
    el.announce('Test message');

    const liveRegion = document.querySelector('[aria-live]');
    expect(liveRegion?.getAttribute('aria-atomic')).toBe('true');
    expect(liveRegion?.getAttribute('role')).toBe('status');
  });

  it('live region is visually hidden but accessible', () => {
    el.announce('Test message');

    const liveRegion = document.querySelector('[aria-live]') as HTMLElement;
    const style = liveRegion.style;

    expect(style.position).toBe('absolute');
    expect(style.width).toBe('1px');
    expect(style.height).toBe('1px');
    expect(style.overflow).toBe('hidden');
    expect(style.clip).toBe('rect(0px, 0px, 0px, 0px)');
    expect(style.whiteSpace).toBe('nowrap');
  });

  it('reuses same live region for multiple announcements', () => {
    el.announce('First message');
    const firstRegion = document.querySelector('[aria-live]');

    el.announce('Second message');
    const secondRegion = document.querySelector('[aria-live]');

    expect(firstRegion).toBe(secondRegion);
    expect(secondRegion?.textContent).toBe('Second message');
  });

  it('can switch priority between announcements', () => {
    el.announce('Polite message', 'polite');
    const region = document.querySelector('[aria-live]');
    expect(region?.getAttribute('aria-live')).toBe('polite');

    el.announce('Assertive message', 'assertive');
    expect(region?.getAttribute('aria-live')).toBe('assertive');
  });

  it('clears content before new announcement (forces screen reader update)', () => {
    el.announce('First message');
    const region = document.querySelector('[aria-live]');

    // Spy on textContent setter to verify the clear -> set sequence
    const originalTextContent = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    const textContentCalls: (string | null)[] = [];

    Object.defineProperty(region, 'textContent', {
      set(value: string | null) {
        textContentCalls.push(value);
        originalTextContent?.set?.call(this, value);
      },
      get() {
        return originalTextContent?.get?.call(this);
      },
      configurable: true,
    });

    el.announce('Second message');

    // Should clear ('') then set new message
    expect(textContentCalls).toContain('');
    expect(textContentCalls).toContain('Second message');
    expect(textContentCalls.indexOf('')).toBeLessThan(textContentCalls.indexOf('Second message'));

    // Restore original descriptor
    Object.defineProperty(region, 'textContent', originalTextContent!);
  });

  it('disconnecting removes the live region element', () => {
    el.announce('Test message');

    const liveRegion = document.querySelector('[aria-live]');
    expect(liveRegion).toBeTruthy();

    el.remove();

    const liveRegionAfter = document.querySelector('[aria-live][role="status"]');
    expect(liveRegionAfter).toBeNull();
  });

  it('multiple components can have independent live regions', async () => {
    const el2 = document.createElement('test-live-region') as TestLiveRegion;
    document.body.appendChild(el2);
    await el2.updateComplete;

    el.announce('Message 1');
    el2.announce('Message 2');

    const regions = document.querySelectorAll('[aria-live]');
    expect(regions.length).toBe(2);

    el.remove();
    el2.remove();
  });
});
