import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { FocusTrapMixin } from './focus-trap.js';

@customElement('test-focus-trap')
class TestFocusTrap extends FocusTrapMixin(LitElement) {}

describe('FocusTrapMixin', () => {
  let el: TestFocusTrap;
  let container: HTMLElement;
  let buttons: HTMLButtonElement[];

  beforeEach(async () => {
    el = document.createElement('test-focus-trap') as TestFocusTrap;
    document.body.appendChild(el);
    await el.updateComplete;

    // Create trap container in light DOM to avoid shadow DOM focus complications
    container = document.createElement('div');
    container.id = 'trap-container';

    const first = document.createElement('button');
    first.id = 'first';
    first.textContent = 'First';

    const middle = document.createElement('button');
    middle.id = 'middle';
    middle.textContent = 'Middle';

    const last = document.createElement('button');
    last.id = 'last';
    last.textContent = 'Last';

    container.appendChild(first);
    container.appendChild(middle);
    container.appendChild(last);
    document.body.appendChild(container);

    buttons = [first, middle, last];
  });

  afterEach(() => {
    el.remove();
    container.remove();
  });

  it('trapFocus() sets focus to first focusable element', () => {
    el.trapFocus(container);
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('Tab wraps from last to first focusable element', () => {
    el.trapFocus(container);
    buttons[2]!.focus();
    expect(document.activeElement).toBe(buttons[2]);

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('Shift+Tab wraps from first to last focusable element', () => {
    el.trapFocus(container);
    buttons[0]!.focus();
    expect(document.activeElement).toBe(buttons[0]);

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[2]);
  });

  it('Tab navigates forward normally within trap', () => {
    el.trapFocus(container);
    buttons[0]!.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    // Should not prevent default when moving within the trap
    expect(event.defaultPrevented).toBe(false);
  });

  it('releaseFocus() restores previous focus', () => {
    const externalButton = document.createElement('button');
    document.body.appendChild(externalButton);
    externalButton.focus();

    expect(document.activeElement).toBe(externalButton);

    el.trapFocus(container);
    expect(document.activeElement).toBe(buttons[0]);

    el.releaseFocus();
    expect(document.activeElement).toBe(externalButton);

    externalButton.remove();
  });

  it('disconnecting component auto-releases trap', () => {
    el.trapFocus(container);
    buttons[2]!.focus();
    expect(document.activeElement).toBe(buttons[2]);

    // Tab event should wrap within trap (last -> first)
    const event1 = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(event1);
    expect(event1.defaultPrevented).toBe(true); // Trap active
    expect(document.activeElement).toBe(buttons[0]); // Wrapped to first

    // Disconnect component (should auto-release)
    el.remove();

    // Create external button and verify tab is no longer trapped
    const outsideButton = document.createElement('button');
    document.body.appendChild(outsideButton);
    outsideButton.focus();

    const event2 = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(event2);
    expect(event2.defaultPrevented).toBe(false); // Trap released

    outsideButton.remove();
  });

  it('releaseFocus() removes keydown listener', () => {
    el.trapFocus(container);
    el.releaseFocus();

    buttons[2]!.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    // Should not prevent default when trap is released
    expect(event.defaultPrevented).toBe(false);
  });

  it('handles empty container gracefully', () => {
    const emptyContainer = document.createElement('div');
    document.body.appendChild(emptyContainer);

    el.trapFocus(emptyContainer);

    // Should not throw and should not prevent tab
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    expect(() => document.dispatchEvent(event)).not.toThrow();
    expect(event.defaultPrevented).toBe(false);

    emptyContainer.remove();
  });
});
