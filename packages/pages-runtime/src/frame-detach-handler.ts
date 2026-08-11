import type { FloatingFrameEngine } from "./floating-frame-engine.js";
import type { ContentFactory } from "@casehubio/pages-component";
import { EventRelay } from "./detach/event-relay.js";
import { copyStyles } from "./detach/copy-styles.js";

export interface FrameDetachHandler {
  detach(frameKey: string): void;
  reattach(frameKey: string): void;
  dispose(): void;
}

interface DetachedFrame {
  childWindow: Window;
  eventRelay: EventRelay;
  pollTimer: ReturnType<typeof setInterval>;
}

export function createFrameDetachHandler(
  engine: FloatingFrameEngine,
  container: HTMLElement,
  contentFactory: ContentFactory,
  signal: AbortSignal,
): FrameDetachHandler {
  const detachedFrames = new Map<string, DetachedFrame>();

  function detach(frameKey: string): void {
    const frame = engine.frames.get(frameKey);
    if (!frame) return;

    engine.hideFrame(frameKey);
    engine.setDetached(frameKey, true);

    const win = window.open("", "_blank", `width=${frame.size.width},height=${frame.size.height}`);
    if (!win) {
      engine.showFrame(frameKey);
      engine.setDetached(frameKey, false);
      console.warn("Popup blocked — allow popups to detach frames.");
      return;
    }

    copyStyles(document, win.document);
    win.document.title = frame.tabs[0]?.label ?? "Frame";
    win.document.body.style.margin = "0";
    win.document.body.style.width = "100%";
    win.document.body.style.height = "100vh";
    win.document.body.style.overflow = "auto";

    for (const tab of frame.tabs) {
      const result = contentFactory(tab);
      win.document.body.appendChild(win.document.adoptNode(result.element));
    }

    const reattachBtn = win.document.createElement("button");
    reattachBtn.textContent = "⏎ Reattach";
    reattachBtn.style.cssText = "position:fixed;top:8px;right:8px;z-index:99999;cursor:pointer;padding:4px 12px;border:1px solid var(--pages-neutral-4, #ccc);border-radius:4px;background:var(--pages-neutral-2, #f5f5f5);font-size:12px;";
    reattachBtn.addEventListener("click", () => reattach(frameKey));
    win.document.body.appendChild(reattachBtn);

    const eventRelay = new EventRelay(win.document, container);
    eventRelay.start();

    win.addEventListener("beforeunload", () => reattach(frameKey));
    const pollTimer = setInterval(() => {
      if (win.closed) reattach(frameKey);
    }, 500);

    detachedFrames.set(frameKey, { childWindow: win, eventRelay, pollTimer });

    container.dispatchEvent(new CustomEvent("pages-frame-detach", {
      bubbles: true, composed: true, detail: { frameKey },
    }));

    win.focus();
  }

  function reattach(frameKey: string): void {
    const entry = detachedFrames.get(frameKey);
    if (!entry) return;
    detachedFrames.delete(frameKey);

    entry.eventRelay.stop();
    clearInterval(entry.pollTimer);

    if (!entry.childWindow.closed) entry.childWindow.close();

    engine.showFrame(frameKey);
    engine.setDetached(frameKey, false);

    container.dispatchEvent(new CustomEvent("pages-frame-reattach", {
      bubbles: true, composed: true, detail: { frameKey },
    }));
  }

  function dispose(): void {
    for (const [key] of detachedFrames) reattach(key);
  }

  signal.addEventListener("abort", dispose);

  return { detach, reattach, dispose };
}
