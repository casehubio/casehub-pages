import type { LitElement } from 'lit';

type Constructor<T = {}> = new (...args: any[]) => T;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function FocusTrapMixin<T extends Constructor<LitElement>>(Base: T) {
  class FocusTrapHost extends Base {
    private _trapContainer: HTMLElement | null = null;
    private _previousFocus: Element | null = null;

    trapFocus(container: HTMLElement): void {
      this._previousFocus = document.activeElement;
      this._trapContainer = container;
      document.addEventListener('keydown', this._handleTrapKeydown);
      const first = container.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }

    releaseFocus(): void {
      document.removeEventListener('keydown', this._handleTrapKeydown);
      this._trapContainer = null;
      if (this._previousFocus instanceof HTMLElement) {
        this._previousFocus.focus();
      }
      this._previousFocus = null;
    }

    private _handleTrapKeydown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab' || !this._trapContainer) return;

      const focusable = Array.from(this._trapContainer.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    override disconnectedCallback(): void {
      super.disconnectedCallback();
      if (this._trapContainer) {
        this.releaseFocus();
      }
    }
  }

  return FocusTrapHost as unknown as Constructor<{
    trapFocus(container: HTMLElement): void;
    releaseFocus(): void;
  }> & T;
}
