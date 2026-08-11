import type { ContentFactory, FrameLayout } from "@casehubio/pages-component";
import type { FloatingFrameBackend, FrameButtonConfig } from "./floating-frame-backend.js";
import { createFloatingFrameEngine } from "./floating-frame-engine.js";
import type { FloatingFrameEngine } from "./floating-frame-engine.js";
import { createFrameDetachHandler, type FrameDetachHandler } from "./frame-detach-handler.js";
import { createFrameZonePicker } from "./frame-zone-picker.js";
import { injectAnimationStyles } from "./frame-animations.js";

export interface WireOptions {
  readonly detachEnabled?: boolean | undefined;
  readonly contentFactory?: ContentFactory | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface WireHandle {
  readonly engine: FloatingFrameEngine;
  readonly detachHandler?: FrameDetachHandler | undefined;
  readonly detachButton?: FrameButtonConfig | undefined;
  readonly zonePickerButton?: FrameButtonConfig | undefined;
  dispose(): void;
}

export function wireFloatingWorkspace(
  backend: FloatingFrameBackend,
  container: HTMLElement,
  savedLayout?: readonly FrameLayout[],
  options?: WireOptions,
): WireHandle {
  const engine = createFloatingFrameEngine(backend, savedLayout);

  backend.onFrameMove((key, pos) => {
    engine.updatePosition(key, pos);
    container.dispatchEvent(new CustomEvent("pages-frame-move", {
      bubbles: true, composed: true,
      detail: { frameKey: key, position: pos },
    }));
  });

  backend.onFrameResize((key, size) => {
    engine.updateSize(key, size);
    container.dispatchEvent(new CustomEvent("pages-frame-resize", {
      bubbles: true, composed: true,
      detail: { frameKey: key, size },
    }));
  });

  backend.onFrameClose((key) => {
    engine.removeFrame(key);
    container.dispatchEvent(new CustomEvent("pages-frame-close", {
      bubbles: true, composed: true,
      detail: { frameKey: key },
    }));
  });

  backend.onFramePin((key) => {
    engine.togglePin(key);
    const frame = engine.frames.get(key);
    const pinned = frame?.pinned ?? false;
    backend.updatePinState(key, pinned);
    container.dispatchEvent(new CustomEvent("pages-frame-pin", {
      bubbles: true, composed: true,
      detail: { frameKey: key, pinned },
    }));
  });

  backend.onTabDragOut((fromFrame, tabKey, position) => {
    const newKey = `frame-${String(Date.now())}-${Math.random().toString(36).slice(2, 6)}`;
    engine.createFrame({ key: newKey, tabs: [], position, size: { width: 400, height: 300 } });
    engine.moveTab(fromFrame, tabKey, newKey);
    const srcFrame = engine.frames.get(fromFrame);
    if (srcFrame && srcFrame.tabs.length === 0) {
      engine.removeFrame(fromFrame);
    }
    container.dispatchEvent(new CustomEvent("pages-tab-drag-out", {
      bubbles: true, composed: true,
      detail: { tabKey, fromFrame, position },
    }));
  });

  backend.onTabReorder((frameKey, tabKeys) => {
    container.dispatchEvent(new CustomEvent("pages-tab-reorder", {
      bubbles: true, composed: true,
      detail: { frameKey, tabKeys },
    }));
  });

  injectAnimationStyles();

  let detachHandler: FrameDetachHandler | undefined;
  let detachButton: FrameButtonConfig | undefined;

  if (options?.detachEnabled !== false && options?.contentFactory && options?.signal) {
    detachHandler = createFrameDetachHandler(engine, container, options.contentFactory, options.signal);
    detachButton = {
      icon: "\u{1F5D7}",
      title: "Pop out to new window",
      className: "frame-detach-btn",
      onClick: (frameKey: string) => detachHandler!.detach(frameKey),
    };
  }

  let zonePickerButton: FrameButtonConfig | undefined;
  if (options?.signal) {
    zonePickerButton = createFrameZonePicker(engine, backend, container, options.signal);
  }

  return {
    engine,
    detachHandler,
    detachButton,
    zonePickerButton,
    dispose() {
      detachHandler?.dispose();
      engine.dispose();
    },
  };
}
