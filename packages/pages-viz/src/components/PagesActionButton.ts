import type { ActionButtonProps, ActionRequest, ActionCallbacks, ActionResult, PagesActionRequestDetail } from "@casehubio/pages-component";
import { PagesContentElement } from "../base/PagesContentElement.js";

export class PagesActionButton extends PagesContentElement<ActionButtonProps> {
  private button: HTMLButtonElement | null = null;
  private messageContainer: HTMLDivElement | null = null;
  private isLoading = false;
  private successTimeoutId: ReturnType<typeof setTimeout> | null = null;

  protected render(container: HTMLDivElement, props: ActionButtonProps): void {
    // Clear previous content
    container.innerHTML = "";

    // Add CSS
    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: inline-block;
      }

      .pages-action-container {
        display: flex;
        flex-direction: column;
        gap: var(--pages-space-2, 0.5rem);
      }

      button {
        padding: var(--pages-btn-padding, 0.5rem 1rem);
        border: none;
        border-radius: var(--pages-radius-sm, 4px);
        font-family: var(--pages-font-family, system-ui, -apple-system, sans-serif);
        font-size: var(--pages-font-size-base, 14px);
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s, opacity 0.2s;
      }

      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .pages-btn-primary {
        background-color: var(--pages-accent-9, #0066cc);
        color: var(--pages-btn-primary-color, white);
      }

      .pages-btn-primary:hover:not(:disabled) {
        background-color: var(--pages-accent-10, #0052a3);
      }

      .pages-btn-danger {
        background-color: var(--pages-danger-9, #dc3545);
        color: var(--pages-btn-danger-color, white);
      }

      .pages-btn-danger:hover:not(:disabled) {
        background-color: var(--pages-danger-10, #bd2130);
      }

      .pages-btn-secondary {
        background-color: var(--pages-neutral-8, #6c757d);
        color: var(--pages-btn-secondary-color, white);
      }

      .pages-btn-secondary:hover:not(:disabled) {
        background-color: var(--pages-neutral-9, #5a6268);
      }

      .pages-btn-ghost {
        background-color: transparent;
        color: var(--pages-accent-9, #0066cc);
      }

      .pages-btn-ghost:hover:not(:disabled) {
        background-color: var(--pages-neutral-3, #f0f0f0);
      }

      .pages-btn-outline {
        background-color: transparent;
        color: var(--pages-accent-9, #0066cc);
        border: 1px solid var(--pages-accent-7, #99c2e6);
      }

      .pages-btn-outline:hover:not(:disabled) {
        background-color: var(--pages-accent-3, #e6f0fa);
      }

      .pages-action-spinner {
        display: inline-block;
        width: 1em;
        height: 1em;
        margin-right: var(--pages-space-1, 0.25rem);
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: pages-spin 0.6s linear infinite;
        vertical-align: middle;
      }

      @keyframes pages-spin {
        to { transform: rotate(360deg); }
      }

      .pages-action-success {
        padding: var(--pages-space-2, 0.5rem);
        background-color: var(--pages-success-3, #d4edda);
        color: var(--pages-success-11, #155724);
        border: 1px solid var(--pages-success-6, #c3e6cb);
        border-radius: var(--pages-radius-sm, 4px);
        font-size: var(--pages-font-size-sm, 13px);
      }

      .pages-action-error {
        padding: var(--pages-space-2, 0.5rem);
        background-color: var(--pages-danger-3, #f8d7da);
        color: var(--pages-danger-11, #721c24);
        border: 1px solid var(--pages-danger-6, #f5c6cb);
        border-radius: var(--pages-radius-sm, 4px);
        font-size: var(--pages-font-size-sm, 13px);
      }
    `;
    container.appendChild(style);

    // Create container
    const wrapper = document.createElement("div");
    wrapper.className = "pages-action-container";

    // Create button
    this.button = document.createElement("button");
    this.button.textContent = props.label;

    const STYLE_CLASSES: Record<string, string> = {
      primary: "pages-btn-primary",
      danger: "pages-btn-danger",
      secondary: "pages-btn-secondary",
      ghost: "pages-btn-ghost",
      outline: "pages-btn-outline",
    };
    this.button.className = STYLE_CLASSES[props.style ?? "primary"] ?? "pages-btn-primary";

    this.button.setAttribute("aria-busy", "false");

    if (props.disabled) {
      this.button.disabled = true;
      this.button.setAttribute("aria-disabled", "true");
    }

    this.button.addEventListener("click", () => { this.handleClick(props); });

    wrapper.appendChild(this.button);

    // Create message container
    this.messageContainer = document.createElement("div");
    wrapper.appendChild(this.messageContainer);

    container.appendChild(wrapper);
  }

  private spinnerEl: HTMLSpanElement | null = null;

  private handleClick(props: ActionButtonProps): void {
    if (this.isLoading || !this.button || props.disabled) return;

    // Show confirmation dialog if configured
    if (props.confirm) {
      const confirmed = window.confirm(props.confirm);
      if (!confirmed) return;
    }

    this.isLoading = true;
    this.button.disabled = true;
    this.button.setAttribute("aria-busy", "true");
    this.spinnerEl = document.createElement("span");
    this.spinnerEl.className = "pages-action-spinner";
    this.spinnerEl.setAttribute("aria-hidden", "true");
    this.button.prepend(this.spinnerEl);

    // Clear previous messages
    if (this.messageContainer) {
      this.messageContainer.innerHTML = "";
    }

    // Dispatch pages-action-request event
    const actionRequest: ActionRequest = {
      url: props.url,
      method: props.method ?? "POST",
      ...(props.body !== undefined && { body: props.body }),
      ...(props.headers !== undefined && { headers: props.headers }),
    };

    const callbacks: ActionCallbacks = {
      ...(props.onSuccess !== undefined && { onSuccess: props.onSuccess }),
      ...(props.onError !== undefined && { onError: props.onError }),
    };

    const detail: PagesActionRequestDetail = {
      config: { ...actionRequest, callbacks },
      resolve: (result: ActionResult) => { this.handleResult(result, props); },
    };

    const event = new CustomEvent<PagesActionRequestDetail>("pages-action-request", {
      detail,
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(event);
  }

  private handleResult(result: ActionResult, props: ActionButtonProps): void {
    this.isLoading = false;
    if (this.button) {
      this.button.disabled = props.disabled ?? false;
      this.button.setAttribute("aria-busy", "false");
      if (this.spinnerEl) {
        this.spinnerEl.remove();
        this.spinnerEl = null;
      }
    }

    if (!this.messageContainer) return;

    // Clear previous messages
    this.messageContainer.innerHTML = "";

    if (result.success) {
      // Show success message
      if (props.onSuccess?.message) {
        const successMsg = document.createElement("div");
        successMsg.className = "pages-action-success";
        successMsg.textContent = props.onSuccess.message;
        this.messageContainer.appendChild(successMsg);

        // Auto-hide after 3 seconds
        this.successTimeoutId = setTimeout(() => {
          if (this.messageContainer?.contains(successMsg)) {
            this.messageContainer.removeChild(successMsg);
          }
          this.successTimeoutId = null;
        }, 3000);
      }
    } else {
      // Show error message
      const errorMsg = document.createElement("div");
      errorMsg.className = "pages-action-error";
      errorMsg.textContent = props.onError?.message ?? result.error ?? "An error occurred";
      this.messageContainer.appendChild(errorMsg);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback?.();
    if (this.successTimeoutId !== null) {
      clearTimeout(this.successTimeoutId);
      this.successTimeoutId = null;
    }
  }
}

customElements.define("pages-action-button", PagesActionButton);
