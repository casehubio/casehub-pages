/**
 * Base class for content Web Components without dataset binding.
 *
 * Used for simple content components like alerts, action buttons, and other
 * components that don't need data machinery (data request, refresh timer, resize observer).
 *
 * Provides:
 * - Shadow DOM with container div for rendering
 * - Props management with automatic update on change
 * - Lifecycle hooks (connectedCallback, disconnectedCallback)
 * - Abstract render method for subclass implementation
 */
export abstract class PagesContentElement<P extends object> extends HTMLElement {
  declare readonly shadowRoot: ShadowRoot;

  private _props: P | undefined;
  protected readonly container: HTMLDivElement;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    this.container = document.createElement("div");
    this.container.style.width = "100%";
    shadow.appendChild(this.container);
  }

  // ── Properties ──────────────────────────────────────────────────────

  get props(): P | undefined {
    return this._props;
  }

  set props(value: P | undefined) {
    this._props = value;
    this.update();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  connectedCallback(): void {
    this.update();
  }

  disconnectedCallback(): void {
    // Hook for subclasses to register/deregister context consumers
  }

  // ── Update / render pipeline ────────────────────────────────────────

  private update(): void {
    if (!this.isConnected) return;
    if (!this._props) return;

    this.render(this.container, this._props);
  }

  // ── Abstract ────────────────────────────────────────────────────────

  protected abstract render(container: HTMLDivElement, props: P): void;
}
