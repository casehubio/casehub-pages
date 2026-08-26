import type { Container, FreeLayoutEntry } from "./types.js";

export interface DndCallbacks {
  onDrop(
    sourceContainer: Container,
    tabKey: string,
    targetFrameKey: string | null,
    x: number,
    y: number,
  ): void;
}

export function createFreeLayoutDnd(
  hostElement: HTMLElement,
  entryState: Map<string, FreeLayoutEntry>,
  frameElements: Map<string, HTMLElement>,
  callbacks: DndCallbacks,
): { dispose(): void } {

  function detectTarget(clientX: number, clientY: number): string | null {
    const hostRect = hostElement.getBoundingClientRect();
    const x = clientX - hostRect.left;
    const y = clientY - hostRect.top;

    for (const [key, state] of entryState) {
      if (!frameElements.has(key)) continue;
      const { position, size } = state;
      if (
        x >= position.x && x <= position.x + size.width &&
        y >= position.y && y <= position.y + size.height
      ) {
        return key;
      }
    }
    return null;
  }

  function onDragStart(e: Event): void {
    const evt = e as CustomEvent<{
      tabKey: string;
      ghost: HTMLElement;
      sourceContainer: Container;
    }>;
    evt.stopPropagation();

    const { tabKey, sourceContainer } = evt.detail;
    let currentTarget: string | null = null;
    let highlightEl: HTMLElement | null = null;

    function clearHighlight(): void {
      if (highlightEl) {
        highlightEl.remove();
        highlightEl = null;
      }
    }

    function setHighlight(frameKey: string): void {
      clearHighlight();
      const frameEl = frameElements.get(frameKey);
      if (!frameEl) return;
      highlightEl = document.createElement("div");
      highlightEl.setAttribute("data-drop-highlight", "");
      highlightEl.style.cssText =
        "position:absolute;inset:0;border:2px solid var(--pages-accent-9,#3b82f6);" +
        "pointer-events:none;z-index:99999;border-radius:4px;";
      frameEl.appendChild(highlightEl);
    }

    function onMove(moveEvt: PointerEvent): void {
      const newTarget = detectTarget(moveEvt.clientX, moveEvt.clientY);
      if (newTarget !== currentTarget) {
        clearHighlight();
        currentTarget = newTarget;
        if (currentTarget) setHighlight(currentTarget);
      }
    }

    function onUp(upEvt: PointerEvent): void {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      clearHighlight();
      callbacks.onDrop(sourceContainer, tabKey, currentTarget, upEvt.clientX, upEvt.clientY);
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
