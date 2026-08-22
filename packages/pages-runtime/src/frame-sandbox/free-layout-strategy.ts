import type {
  Entry,
  ContentFactory,
  LayoutStrategy,
  LayoutCallbacks,
  FreeLayoutState,
  FreeLayoutEntry,
} from "./types.js";

const MIN_WIDTH = 100;
const MIN_HEIGHT = 80;

function createResizeHandles(
  frameEl: HTMLElement,
  key: string,
  state: FreeLayoutEntry,
  callbacks?: LayoutCallbacks,
): void {
  const handles = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
  const cursors: Record<string, string> = {
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
    ne: "nesw-resize",
    nw: "nwse-resize",
    se: "nwse-resize",
    sw: "nesw-resize",
  };

  for (const dir of handles) {
    const handle = document.createElement("div");
    handle.setAttribute("data-resize-handle", dir);
    handle.style.cssText = `position:absolute;cursor:${cursors[dir]};`;

    const size = "6px";
    if (dir.includes("n")) {
      handle.style.top = "0";
      handle.style.height = size;
    }
    if (dir.includes("s")) {
      handle.style.bottom = "0";
      handle.style.height = size;
    }
    if (dir.includes("e")) {
      handle.style.right = "0";
      handle.style.width = size;
    }
    if (dir.includes("w")) {
      handle.style.left = "0";
      handle.style.width = size;
    }
    if (dir === "n" || dir === "s") {
      handle.style.left = size;
      handle.style.right = size;
    }
    if (dir === "e" || dir === "w") {
      handle.style.top = size;
      handle.style.bottom = size;
    }
    if (dir.length === 2) {
      handle.style.width = size;
      handle.style.height = size;
    }

    handle.addEventListener("pointerdown", (startEvt) => {
      startEvt.stopPropagation();
      const startX = startEvt.clientX;
      const startY = startEvt.clientY;
      const startW = state.size.width;
      const startH = state.size.height;
      const startLeft = state.position.x;
      const startTop = state.position.y;

      const onMove = (e: PointerEvent) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newW = startW;
        let newH = startH;
        let newX = startLeft;
        let newY = startTop;

        if (dir.includes("e"))
          newW = Math.max(MIN_WIDTH, startW + dx);
        if (dir.includes("w")) {
          newW = Math.max(MIN_WIDTH, startW - dx);
          newX = startLeft + (startW - newW);
        }
        if (dir.includes("s"))
          newH = Math.max(MIN_HEIGHT, startH + dy);
        if (dir.includes("n")) {
          newH = Math.max(MIN_HEIGHT, startH - dy);
          newY = startTop + (startH - newH);
        }

        state.size = { width: newW, height: newH };
        state.position = { x: newX, y: newY };
        frameEl.style.left = `${newX}px`;
        frameEl.style.top = `${newY}px`;
        frameEl.style.width = `${newW}px`;
        frameEl.style.height = `${newH}px`;
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        callbacks?.onEntryResize?.(key, state.size.width, state.size.height);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });

    frameEl.appendChild(handle);
  }
}

export function createFreeLayoutStrategy(
  initialState?: FreeLayoutState,
  callbacks?: LayoutCallbacks,
): LayoutStrategy {
  let containerEl: HTMLElement | null = null;
  let currentEntries: Entry[] = [];
  let factory: ContentFactory | null = null;
  const entryState = new Map<string, FreeLayoutEntry>();
  const frameElements = new Map<string, HTMLElement>();
  let zOrder: string[] = initialState?.zOrder ? [...initialState.zOrder] : [];
  let nextDefaultOffset = 0;

  function ensureContent(entry: Entry): HTMLElement {
    if (!entry.contentElement && factory) {
      const result = factory(entry);
      entry.contentElement = result.element;
      entry.contentDispose = result.dispose;
    }
    return entry.contentElement!;
  }

  function applyZOrder(): void {
    for (let i = 0; i < zOrder.length; i++) {
      const el = frameElements.get(zOrder[i]!);
      if (el) el.style.zIndex = String(i + 1);
    }
  }

  function bringToFront(key: string): void {
    zOrder = zOrder.filter((k) => k !== key);
    zOrder.push(key);
    applyZOrder();
  }

  function createFrame(entry: Entry): HTMLElement {
    let state = entryState.get(entry.key);
    if (!state) {
      const initial = initialState?.entries[entry.key];
      const meta = entry.meta?.free;
      if (initial) {
        state = { position: { ...initial.position }, size: { ...initial.size } };
      } else if (meta) {
        state = { position: { x: meta.x, y: meta.y }, size: { width: meta.width, height: meta.height } };
      } else {
        const offset = nextDefaultOffset * 30;
        state = { position: { x: 50 + offset, y: 50 + offset }, size: { width: 300, height: 200 } };
        nextDefaultOffset++;
        if (!entry.meta) (entry as { meta?: unknown }).meta = {};
        entry.meta!.free = { x: state.position.x, y: state.position.y, width: state.size.width, height: state.size.height };
      }
      entryState.set(entry.key, state);
    }

    const frame = document.createElement("div");
    frame.setAttribute("data-frame-key", entry.key);
    frame.style.cssText =
      `position:absolute;` +
      `left:${state.position.x}px;top:${state.position.y}px;` +
      `width:${state.size.width}px;height:${state.size.height}px;` +
      `display:flex;flex-direction:column;` +
      `background:var(--pages-surface-1,#1e1e1e);` +
      `border:1px solid var(--pages-border-1,#333);` +
      `border-radius:6px;overflow:hidden;`;

    frame.addEventListener("pointerdown", () => {
      bringToFront(entry.key);
    }, { capture: true });

    const titlebar = document.createElement("div");
    titlebar.setAttribute("data-frame-titlebar", "");
    titlebar.style.cssText =
      "display:flex;align-items:center;padding:4px 8px;" +
      "background:var(--pages-surface-2,#2a2a2a);cursor:grab;" +
      "user-select:none;border-bottom:1px solid var(--pages-border-1,#333);";
    titlebar.textContent = entry.label;

    const capturedState = state;
    titlebar.addEventListener("pointerdown", (startEvt) => {
      const startX = startEvt.clientX;
      const startY = startEvt.clientY;
      const startLeft = capturedState.position.x;
      const startTop = capturedState.position.y;

      const onMove = (e: PointerEvent) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        capturedState.position = { x: startLeft + dx, y: startTop + dy };
        frame.style.left = `${capturedState.position.x}px`;
        frame.style.top = `${capturedState.position.y}px`;
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        callbacks?.onEntryMove?.(
          entry.key,
          capturedState.position.x,
          capturedState.position.y,
        );
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });

    const contentArea = document.createElement("div");
    contentArea.setAttribute("data-frame-content", "");
    contentArea.style.cssText = "flex:1;overflow:auto;";
    contentArea.appendChild(ensureContent(entry));

    frame.appendChild(titlebar);
    frame.appendChild(contentArea);

    createResizeHandles(frame, entry.key, state, callbacks);

    frameElements.set(entry.key, frame);
    return frame;
  }

  const organiser: LayoutStrategy = {
    type: "free",

    mount(container, entries, contentFactory) {
      containerEl = container;
      currentEntries = [...entries];
      factory = contentFactory;
      container.style.cssText += "position:relative;";

      if (zOrder.length === 0) {
        zOrder = entries.map((e) => e.key);
      }

      for (const entry of currentEntries) {
        container.appendChild(createFrame(entry));
      }
      applyZOrder();
    },

    unmount() {
      for (const entry of currentEntries) {
        const contentArea = frameElements
          .get(entry.key)
          ?.querySelector("[data-frame-content]");
        if (contentArea?.firstChild) {
          contentArea.removeChild(contentArea.firstChild);
        }
      }

      for (const el of frameElements.values()) el.remove();
      frameElements.clear();
      if (containerEl) containerEl.style.cssText = "";
      containerEl = null;
      factory = null;
    },

    addEntry(entry, _atIndex?) {
      currentEntries.push(entry);
      zOrder.push(entry.key);
      if (containerEl) {
        containerEl.appendChild(createFrame(entry));
      }
    },

    removeEntry(key) {
      const idx = currentEntries.findIndex((e) => e.key === key);
      if (idx === -1) return;

      const entry = currentEntries[idx]!;
      entry.contentDispose?.();
      delete entry.contentElement;
      delete entry.contentDispose;
      currentEntries.splice(idx, 1);

      frameElements.get(key)?.remove();
      frameElements.delete(key);
      entryState.delete(key);
      zOrder = zOrder.filter((k) => k !== key);

      callbacks?.onEntryClose?.(key);
    },

    getState(): FreeLayoutState {
      const entries: Record<string, FreeLayoutEntry> = {};
      for (const [key, state] of entryState) {
        entries[key] = {
          position: { ...state.position },
          size: { ...state.size },
        };
      }
      return { entries, zOrder: [...zOrder] };
    },

    restoreState() {},
    dispose() {
      for (const entry of currentEntries) {
        entry.contentDispose?.();
        entry.contentElement = undefined;
        entry.contentDispose = undefined;
      }
      organiser.unmount();
      currentEntries = [];
      entryState.clear();
      zOrder = [];
    },
  };

  return organiser;
}
