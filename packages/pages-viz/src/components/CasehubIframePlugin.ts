import type { TypedDataSet } from "@casehubio/pages-data/dist/dataset/types.js";
import type { IframePluginProps } from "@casehubio/pages-component";
import { toWireDataSet } from "@casehubio/pages-data/dist/dataset/conversion.js";
import { CasehubElement } from "../base/CasehubElement.js";

const IFRAME_CSS = `
:host {
  display: block;
}
iframe {
  border: none;
  width: 100%;
  height: 100%;
}
`;

export class CasehubIframePlugin extends CasehubElement<IframePluginProps> {
  private _iframe: HTMLIFrameElement | undefined;
  private _messageHandler: ((e: MessageEvent) => void) | undefined;
  private _loaded = false;
  private _pendingProps: IframePluginProps | undefined;
  private _pendingDataset: TypedDataSet | undefined;

  protected override render(
    container: HTMLDivElement,
    props: IframePluginProps,
    dataset: TypedDataSet,
  ): void {
    const expectedSrc = `/pages/component/${props.componentId}/index.html`;

    // Check if iframe exists with wrong src (componentId changed)
    if (this._iframe && this._iframe.src && !this._iframe.src.endsWith(expectedSrc)) {
      // Remove old iframe
      this._iframe.remove();
      this._iframe = undefined;
      this._loaded = false;
    }

    if (!this._iframe) {
      this.createIframe(container, props);
    }

    // If loaded, send immediately; otherwise store pending
    if (this._loaded) {
      this.sendMessages(props, dataset);
    } else {
      this._pendingProps = props;
      this._pendingDataset = dataset;
    }
  }

  private createIframe(container: HTMLDivElement, props: IframePluginProps): void {
    container.textContent = "";

    // Style
    const style = document.createElement("style");
    style.textContent = IFRAME_CSS;
    container.appendChild(style);

    // Iframe
    this._iframe = document.createElement("iframe");
    this._iframe.src = `/pages/component/${props.componentId}/index.html`;
    this._iframe.style.width = props.width ?? "100%";
    this._iframe.style.height = props.height ?? "100%";

    // Load event listener
    this._iframe.addEventListener("load", () => {
      this._loaded = true;
      if (this._pendingProps && this._pendingDataset) {
        this.sendMessages(this._pendingProps, this._pendingDataset);
        this._pendingProps = undefined;
        this._pendingDataset = undefined;
      }
    });

    container.appendChild(this._iframe);

    // Message listener
    this._messageHandler = (e: MessageEvent) => {
      this.handleMessage(e);
    };
    window.addEventListener("message", this._messageHandler);
  }

  private sendMessages(props: IframePluginProps, dataset: TypedDataSet): void {
    if (!this._iframe?.contentWindow) return;

    // INIT message
    this._iframe.contentWindow.postMessage(
      {
        type: "INIT",
        properties: {
          COMPONENT_ID: props.componentId,
          MODE: this.theme || "light",
        },
      },
      "*",
    );

    // DATASET message
    const wireDataSet = toWireDataSet(dataset);
    const properties: Record<string, unknown> = {
      COMPONENT_ID: props.componentId,
      DATASET: wireDataSet,
      ...Object.fromEntries(Object.entries(props.settings ?? {})),
    };

    this._iframe.contentWindow.postMessage(
      {
        type: "DATASET",
        properties,
      },
      "*",
    );
  }

  private handleMessage(e: MessageEvent): void {
    const msg = e.data as Record<string, unknown> | null | undefined;
    if (!msg || msg.type !== "FILTER") return;

    const msgProps = msg.properties as Record<string, unknown> | undefined;
    const props = this.props;
    const dataset = this.dataSet;

    if (!props || !dataset) return;
    if (!msgProps || msgProps.COMPONENT_ID !== props.componentId) return;

    const filter = msgProps.FILTER as Record<string, unknown> | undefined;
    if (!filter) return;

    const columnIndex = filter.column;
    if (typeof columnIndex !== "number") return;
    const columnId = dataset.columns[columnIndex]?.id;
    if (!columnId) return;

    const row = filter.row;
    if (typeof row !== "number") return;

    const reset = filter.reset;

    this.dispatchEvent(
      new CustomEvent("casehub-filter", {
        bubbles: true,
        composed: true,
        detail: {
          columnId,
          rowIndex: row,
          reset: typeof reset === "boolean" ? reset : false,
          group: props.filter?.group,
        },
      }),
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    if (this._messageHandler) {
      window.removeEventListener("message", this._messageHandler);
      this._messageHandler = undefined;
    }
  }
}

customElements.define("casehub-iframe-plugin", CasehubIframePlugin);
