import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { RovingTabindexMixin } from './roving-tabindex.js';

// ---------- vertical test host ----------
@customElement('test-roving-vertical')
class TestRovingVertical extends RovingTabindexMixin(LitElement) {
  override rovingSelector = '[role="option"]';
  override rovingDirection = 'vertical' as const;

  override render() {
    return html`
      <div role="listbox">
        <div role="option" tabindex="-1">A</div>
        <div role="option" tabindex="-1">B</div>
        <div role="option" tabindex="-1">C</div>
      </div>
    `;
  }
}

// ---------- horizontal test host ----------
@customElement('test-roving-horizontal')
class TestRovingHorizontal extends RovingTabindexMixin(LitElement) {
  override rovingSelector = '[role="tab"]';
  override rovingDirection = 'horizontal' as const;

  override render() {
    return html`
      <div role="tablist">
        <div role="tab" tabindex="-1">Tab1</div>
        <div role="tab" tabindex="-1">Tab2</div>
        <div role="tab" tabindex="-1">Tab3</div>
      </div>
    `;
  }
}

// ---------- both test host ----------
@customElement('test-roving-both')
class TestRovingBoth extends RovingTabindexMixin(LitElement) {
  override rovingSelector = '[role="gridcell"]';
  override rovingDirection = 'both' as const;

  override render() {
    return html`
      <div role="grid">
        <div role="gridcell" tabindex="-1">1</div>
        <div role="gridcell" tabindex="-1">2</div>
        <div role="gridcell" tabindex="-1">3</div>
      </div>
    `;
  }
}

describe('RovingTabindexMixin', () => {
  // ===== vertical direction (original behaviour) =====
  describe('vertical direction', () => {
    let el: TestRovingVertical;

    beforeEach(async () => {
      el = document.createElement('test-roving-vertical') as TestRovingVertical;
      document.body.appendChild(el);
      await el.updateComplete;
    });

    afterEach(() => el.remove());

    it('sets first item tabindex to 0 on focus', () => {
      const items = el.shadowRoot!.querySelectorAll('[role="option"]');
      el.dispatchEvent(new FocusEvent('focusin'));
      expect(items[0]!.getAttribute('tabindex')).toBe('0');
    });

    it('navigateRoving("next") increments index', () => {
      el.rovingIndex = 0;
      el.navigateRoving('next');
      expect(el.rovingIndex).toBe(1);
    });

    it('wraps around at end', () => {
      el.rovingIndex = 2;
      el.navigateRoving('next');
      expect(el.rovingIndex).toBe(0);
    });

    it('Home jumps to first, End to last', () => {
      el.rovingIndex = 1;
      el.navigateRoving('first');
      expect(el.rovingIndex).toBe(0);
      el.navigateRoving('last');
      expect(el.rovingIndex).toBe(2);
    });

    it('ArrowDown triggers next', () => {
      el.rovingIndex = 0;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(el.rovingIndex).toBe(1);
    });

    it('ArrowUp triggers prev', () => {
      el.rovingIndex = 1;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(el.rovingIndex).toBe(0);
    });

    it('ArrowLeft is ignored in vertical mode', () => {
      el.rovingIndex = 1;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      expect(el.rovingIndex).toBe(1);
    });

    it('ArrowRight is ignored in vertical mode', () => {
      el.rovingIndex = 1;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(el.rovingIndex).toBe(1);
    });

    it('Home and End keys work', () => {
      el.rovingIndex = 1;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      expect(el.rovingIndex).toBe(0);
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      expect(el.rovingIndex).toBe(2);
    });
  });

  // ===== horizontal direction =====
  describe('horizontal direction', () => {
    let el: TestRovingHorizontal;

    beforeEach(async () => {
      el = document.createElement('test-roving-horizontal') as TestRovingHorizontal;
      document.body.appendChild(el);
      await el.updateComplete;
    });

    afterEach(() => el.remove());

    it('ArrowRight triggers next', () => {
      el.rovingIndex = 0;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(el.rovingIndex).toBe(1);
    });

    it('ArrowLeft triggers prev', () => {
      el.rovingIndex = 1;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      expect(el.rovingIndex).toBe(0);
    });

    it('ArrowDown is ignored in horizontal mode', () => {
      el.rovingIndex = 1;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(el.rovingIndex).toBe(1);
    });

    it('ArrowUp is ignored in horizontal mode', () => {
      el.rovingIndex = 1;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(el.rovingIndex).toBe(1);
    });

    it('wraps around at end', () => {
      el.rovingIndex = 2;
      el.navigateRoving('next');
      expect(el.rovingIndex).toBe(0);
    });

    it('wraps around at start', () => {
      el.rovingIndex = 0;
      el.navigateRoving('prev');
      expect(el.rovingIndex).toBe(2);
    });

    it('Home and End keys work', () => {
      el.rovingIndex = 1;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      expect(el.rovingIndex).toBe(0);
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      expect(el.rovingIndex).toBe(2);
    });
  });

  // ===== both direction =====
  describe('both direction', () => {
    let el: TestRovingBoth;

    beforeEach(async () => {
      el = document.createElement('test-roving-both') as TestRovingBoth;
      document.body.appendChild(el);
      await el.updateComplete;
    });

    afterEach(() => el.remove());

    it('ArrowDown triggers next', () => {
      el.rovingIndex = 0;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(el.rovingIndex).toBe(1);
    });

    it('ArrowUp triggers prev', () => {
      el.rovingIndex = 1;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(el.rovingIndex).toBe(0);
    });

    it('ArrowRight triggers next', () => {
      el.rovingIndex = 0;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(el.rovingIndex).toBe(1);
    });

    it('ArrowLeft triggers prev', () => {
      el.rovingIndex = 1;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      expect(el.rovingIndex).toBe(0);
    });

    it('Home and End keys work', () => {
      el.rovingIndex = 1;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      expect(el.rovingIndex).toBe(0);
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      expect(el.rovingIndex).toBe(2);
    });
  });
});
