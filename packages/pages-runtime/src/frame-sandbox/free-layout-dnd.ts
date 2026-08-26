import type { Container, FreeLayoutEntry } from "./types.js";
import { detectEdgeZone, type EdgeZone } from "../frame-boundaries.js";

export type { EdgeZone };

const EDGE_THRESHOLD = 40;

export interface DndCallbacks {
  onDrop(
    sourceContainer: Container,
    tabKey: string,
    targetFrameKey: string | null,
    x: number,
    y: number,
    insertIndex?: number,
  ): void;
  onEdgeSplit?(
    sourceContainer: Container,
    tabKey: string,
    targetFrameKey: string,
    edge: EdgeZone,
  ): void;
}

export function createFreeLayoutDnd(
  hostElement: HTMLElement,
  entryState: Map<string, FreeLayoutEntry>,
  frameElements: Map<string, HTMLElement>,
  callbacks: DndCallbacks,
): { dispose(): void } {

  function detectTarget(clientX: number, clientY: number): {
    frameKey: string | null;
    edge: EdgeZone | null;
    overStrip: boolean;
  } {
    const hostRect = hostElement.getBoundingClientRect();
    const x = clientX - hostRect.left;
    const y = clientY - hostRect.top;

    for (const [key, state] of entryState) {
      const frameEl = frameElements.get(key);
      if (!frameEl) continue;
      const { position, size } = state;
      if (
        x >= position.x && x <= position.x + size.width &&
        y >= position.y && y <= position.y + size.height
      ) {
        const strip = frameEl.querySelector("[data-tab-strip]") as HTMLElement | null;
        if (strip) {
          const stripRect = strip.getBoundingClientRect();
          if (clientX >= stripRect.left && clientX <= stripRect.right && clientY >= stripRect.top - 15 && clientY <= stripRect.bottom + 15) {
            return { frameKey: key, edge: null, overStrip: true };
          }
        }
        const edge = detectEdgeZone(
          { x, y },
          { x: position.x, y: position.y, width: size.width, height: size.height },
          EDGE_THRESHOLD,
        );
        return { frameKey: key, edge, overStrip: false };
      }
    }
    return { frameKey: null, edge: null, overStrip: false };
  }

  function isOutsideHost(clientX: number, clientY: number): boolean {
    const hostRect = hostElement.getBoundingClientRect();
    return (
      clientX < hostRect.left ||
      clientX > hostRect.right ||
      clientY < hostRect.top ||
      clientY > hostRect.bottom
    );
  }

  function onDragStart(e: Event): void {
    const evt = e as CustomEvent<{
      tabKey: string;
      ghost: HTMLElement;
      sourceContainer: Container;
    }>;
    evt.stopPropagation();

    const { tabKey, ghost, sourceContainer } = evt.detail;
    let currentFrameKey: string | null = null;
    let currentEdge: EdgeZone | null = null;
    let currentOverStrip = false;
    let highlightEl: HTMLElement | null = null;
    let tabPreviewEl: HTMLElement | null = null;
    let stripInsertIndex = -1;
    let escaped = false;

    function clearHighlight(): void {
      if (highlightEl) {
        highlightEl.remove();
        highlightEl = null;
      }
      if (tabPreviewEl) {
        tabPreviewEl.remove();
        tabPreviewEl = null;
      }
    }

    function showTabPreview(frameKey: string, clientX: number): void {
      const frameEl = frameElements.get(frameKey);
      if (!frameEl) return;
      const strip = frameEl.querySelector("[data-tab-strip]") as HTMLElement | null;
      if (!strip) return;

      if (!tabPreviewEl) {
        const srcEntry = sourceContainer.entries.find(en => en.key === tabKey);
        tabPreviewEl = document.createElement("button");
        tabPreviewEl.setAttribute("data-tab-preview", "");
        tabPreviewEl.textContent = srcEntry?.label ?? tabKey;
        tabPreviewEl.style.cssText =
          "padding:4px 12px;border:none;" +
          "background:var(--pages-surface-3,#333);" +
          "color:var(--pages-text-1,#e0e0e0);" +
          "opacity:0.5;pointer-events:none;" +
          "border-bottom:2px solid transparent;" +
          "transition:all 0.15s ease;";
      }

      const buttons = [...strip.querySelectorAll("[data-tab-key]")] as HTMLElement[];
      let insertBefore: HTMLElement | null = null;
      stripInsertIndex = buttons.length;
      for (let i = 0; i < buttons.length; i++) {
        const bRect = buttons[i]!.getBoundingClientRect();
        const mid = bRect.left + bRect.width / 2;
        if (clientX < mid) {
          insertBefore = buttons[i]!;
          stripInsertIndex = i;
          break;
        }
      }
      if (insertBefore) {
        strip.insertBefore(tabPreviewEl, insertBefore);
      } else {
        const sentinel = strip.querySelector("[data-container-toolbar], [data-toolbar-actions]");
        if (sentinel) strip.insertBefore(tabPreviewEl, sentinel);
        else strip.appendChild(tabPreviewEl);
      }
    }

    function setHighlight(frameKey: string, edge: EdgeZone | null): void {
      clearHighlight();
      const frameEl = frameElements.get(frameKey);
      if (!frameEl) return;
      highlightEl = document.createElement("div");

      if (edge) {
        highlightEl.setAttribute("data-split-preview", edge);
        const contentArea = frameEl.querySelector("[data-frame-content]") as HTMLElement | null;
        const ref = contentArea ?? frameEl;
        const frameRect = frameEl.getBoundingClientRect();
        const refRect = ref.getBoundingClientRect();
        const top = refRect.top - frameRect.top;
        const left = refRect.left - frameRect.left;
        highlightEl.style.cssText =
          "position:absolute;pointer-events:none;" +
          "background:var(--pages-accent-3,#3b82f6);opacity:0.2;z-index:9999;";
        switch (edge) {
          case "left":
            highlightEl.style.top = `${top}px`; highlightEl.style.left = `${left}px`;
            highlightEl.style.width = `${EDGE_THRESHOLD}px`; highlightEl.style.height = `${refRect.height}px`;
            break;
          case "right":
            highlightEl.style.top = `${top}px`; highlightEl.style.left = `${left + refRect.width - EDGE_THRESHOLD}px`;
            highlightEl.style.width = `${EDGE_THRESHOLD}px`; highlightEl.style.height = `${refRect.height}px`;
            break;
          case "top":
            highlightEl.style.top = `${top}px`; highlightEl.style.left = `${left}px`;
            highlightEl.style.width = `${refRect.width}px`; highlightEl.style.height = `${EDGE_THRESHOLD}px`;
            break;
          case "bottom":
            highlightEl.style.top = `${top + refRect.height - EDGE_THRESHOLD}px`; highlightEl.style.left = `${left}px`;
            highlightEl.style.width = `${refRect.width}px`; highlightEl.style.height = `${EDGE_THRESHOLD}px`;
            break;
        }
      } else {
        highlightEl.setAttribute("data-drop-highlight", "");
        highlightEl.style.cssText =
          "position:absolute;inset:0;border:2px solid var(--pages-accent-9,#3b82f6);" +
          "pointer-events:none;z-index:99999;border-radius:4px;";
      }

      frameEl.appendChild(highlightEl);
    }

    function cleanup(): void {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      clearHighlight();
    }

    function onMove(moveEvt: PointerEvent): void {
      if (escaped) return;

      if (isOutsideHost(moveEvt.clientX, moveEvt.clientY)) {
        escaped = true;
        cleanup();
        hostElement.dispatchEvent(new CustomEvent("pages-tab-escaped", {
          bubbles: true,
          detail: { tabKey, ghost, sourceContainer },
        }));
        return;
      }

      const { frameKey, edge, overStrip } = detectTarget(moveEvt.clientX, moveEvt.clientY);
      if (frameKey !== currentFrameKey || edge !== currentEdge || overStrip !== currentOverStrip) {
        clearHighlight();
        currentFrameKey = frameKey;
        currentEdge = edge;
        currentOverStrip = overStrip;
        if (currentFrameKey) {
          if (currentOverStrip) {
            showTabPreview(currentFrameKey, moveEvt.clientX);
          } else {
            setHighlight(currentFrameKey, currentEdge);
          }
        }
      } else if (currentOverStrip && currentFrameKey) {
        showTabPreview(currentFrameKey, moveEvt.clientX);
      }
    }

    function onUp(upEvt: PointerEvent): void {
      cleanup();
      if (escaped) return;

      if (currentOverStrip && currentFrameKey) {
        callbacks.onDrop(sourceContainer, tabKey, currentFrameKey, upEvt.clientX, upEvt.clientY, stripInsertIndex >= 0 ? stripInsertIndex : undefined);
      } else if (currentFrameKey && currentEdge && callbacks.onEdgeSplit) {
        callbacks.onEdgeSplit(sourceContainer, tabKey, currentFrameKey, currentEdge);
      } else {
        callbacks.onDrop(sourceContainer, tabKey, currentFrameKey, upEvt.clientX, upEvt.clientY);
      }
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  hostElement.addEventListener("pages-tab-drag-start", onDragStart);

  return {
    dispose() {
      hostElement.removeEventListener("pages-tab-drag-start", onDragStart);
    },
  };
}
