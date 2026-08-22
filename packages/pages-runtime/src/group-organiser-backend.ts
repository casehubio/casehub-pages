import type {
  FrameLayout,
  FrameTabConfig,
  ContentFactory,
} from "@casehubio/pages-component";
import type {
  FloatingFrameBackend,
  BackendAttachOptions,
  FrameButtonConfig,
} from "./floating-frame-backend.js";
import {
  createContainer,
  type Container,
  type ContainerConfig,
  type Entry,
  type ContentFactory as SandboxContentFactory,
  type LayoutCallbacks,
  type Layout,
} from "./frame-sandbox/index.js";
import { detectEdgeZone, edgeToDirection, type EdgeZone } from "./frame-boundaries.js";
import { injectFrameChrome, updatePinVisual } from "./frame-chrome.js";

type MoveCb = (key: string, pos: { x: number; y: number }) => void;
type ResizeCb = (
  key: string,
  size: { width: number; height: number },
) => void;
type TabDragOutCb = (
  fromFrame: string,
  tabKey: string,
  position: { x: number; y: number },
) => void;
type TabReorderCb = (frameKey: string, tabKeys: string[]) => void;
type FrameKeyCb = (key: string) => void;
type DragMoveCb = (key: string, pos: { x: number; y: number }) => void;
type TabRemovedCb = (frameKey: string, tabKey: string) => void;
type LayoutChangeCb = (frameKey: string, layout: Layout) => void;

interface FrameState {
  readonly key: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  frameEl: HTMLElement;
  rootContainer: Container;
  tabContentEl: HTMLElement;
  childContainers: Map<string, Container>;
}

// --- Container tree helpers ---

function isSplitLayout(layout: Layout): boolean {
  return layout === "splith" || layout === "splitv";
}

function findLeafContainer(
  container: Container,
  childMap: Map<string, Container>,
  predicate?: (c: Container) => boolean,
): Container | null {
  const layout = container.organiser.type;
  if (isSplitLayout(layout)) {
    for (const entry of container.entries) {
      const child = childMap.get(entry.key);
      if (child) {
        const found = findLeafContainer(child, childMap, predicate);
        if (found) return found;
      }
    }
    return null;
  }
  if (!predicate || predicate(container)) return container;
  return null;
}

function findContainerWithTab(
  container: Container,
  tabKey: string,
  childMap: Map<string, Container>,
): Container | null {
  const layout = container.organiser.type;
  if (isSplitLayout(layout)) {
    for (const entry of container.entries) {
      const child = childMap.get(entry.key);
      if (child) {
        const found = findContainerWithTab(child, tabKey, childMap);
        if (found) return found;
      }
    }
    return null;
  }
  if (container.entries.some(e => e.key === tabKey)) return container;
  return null;
}

function forEachLeafContainer(
  container: Container,
  childMap: Map<string, Container>,
  callback: (container: Container, paneKey?: string) => void,
  paneKey?: string,
): void {
  const layout = container.organiser.type;
  if (isSplitLayout(layout)) {
    for (const entry of container.entries) {
      const child = childMap.get(entry.key);
      if (child) forEachLeafContainer(child, childMap, callback, entry.key);
    }
    return;
  }
  callback(container, paneKey);
}

function findParentSplitEntry(
  root: Container,
  childMap: Map<string, Container>,
  targetContainer: Container,
): { parent: Container; entryKey: string } | null {
  const layout = root.organiser.type;
  if (!isSplitLayout(layout)) return null;
  for (const entry of root.entries) {
    const child = childMap.get(entry.key);
    if (child === targetContainer) return { parent: root, entryKey: entry.key };
    if (child) {
      const found = findParentSplitEntry(child, childMap, targetContainer);
      if (found) return found;
    }
  }
  return null;
}

const D = (...args: unknown[]) => console.debug("[compositor]", ...args);

export function createGroupOrganiserBackend(): FloatingFrameBackend {
  let containerEl: HTMLElement | null = null;
  let contentFactory: ContentFactory | null = null;
  let extraButtons: readonly FrameButtonConfig[] = [];

  const frames = new Map<string, FrameState>();
  let zOrder: string[] = [];

  const moveCbs: MoveCb[] = [];
  const resizeCbs: ResizeCb[] = [];
  const tabDragOutCbs: TabDragOutCb[] = [];
  const tabReorderCbs: TabReorderCb[] = [];
  const closeCbs: FrameKeyCb[] = [];
  const pinCbs: FrameKeyCb[] = [];
  const dragMoveCbs: DragMoveCb[] = [];
  const dblClickCbs: FrameKeyCb[] = [];
  const viewModeCbs: FrameKeyCb[] = [];
  const addTabCbs: FrameKeyCb[] = [];
  const tabRemovedCbs: TabRemovedCb[] = [];
  const arrangementCbs: ((frameKey: string, preset: string) => void)[] = [];
  const detachCbs: FrameKeyCb[] = [];
  const crossFrameDropCbs: ((
    fromFrame: string,
    tabKey: string,
    toFrame: string,
  ) => void)[] = [];
  const edgeSplitCbs: ((fromFrame: string, tabKey: string, targetFrame: string, zone: EdgeZone) => void)[] = [];
  const layoutChangeCbs: LayoutChangeCb[] = [];
  let suppressEntryClose = false;

  let dragState: {
    sourceFrame: string;
    tabKey: string;
    ghost: HTMLElement;
    targetFrame?: string | undefined;
  } | null = null;
  let crossFramePreview: {
    frameKey: string;
    placeholder: HTMLElement;
    insertIndex: number;
  } | null = null;

  function cleanupCrossFramePreview(): void {
    if (crossFramePreview) {
      crossFramePreview.placeholder.remove();
      crossFramePreview = null;
    }
    if (dragState) dragState.targetFrame = undefined;
  }

  let edgeSplitPreview: {
    frameKey: string;
    zone: EdgeZone;
    overlay: HTMLElement;
  } | null = null;

  const EDGE_THRESHOLD = 40;

  function cleanupEdgeSplitPreview(): void {
    if (edgeSplitPreview) {
      edgeSplitPreview.overlay.remove();
      edgeSplitPreview = null;
    }
  }

  function showEdgeSplitOverlay(frameKey: string, zone: EdgeZone, targetEl: HTMLElement): void {
    const state = frames.get(frameKey);
    if (!state) return;

    if (edgeSplitPreview?.frameKey === frameKey && edgeSplitPreview?.zone === zone) return;
    cleanupEdgeSplitPreview();

    const overlay = document.createElement("div");
    overlay.setAttribute("data-edge-split-overlay", zone);
    overlay.style.cssText =
      "position:absolute;pointer-events:none;" +
      "background:var(--pages-accent-3,#3b82f6);opacity:0.2;z-index:9999;";

    const frameRect = state.frameEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const top = targetRect.top - frameRect.top;
    const left = targetRect.left - frameRect.left;

    switch (zone) {
      case "left":
        overlay.style.top = `${top}px`; overlay.style.left = `${left}px`;
        overlay.style.width = `${EDGE_THRESHOLD}px`; overlay.style.height = `${targetRect.height}px`;
        break;
      case "right":
        overlay.style.top = `${top}px`; overlay.style.left = `${left + targetRect.width - EDGE_THRESHOLD}px`;
        overlay.style.width = `${EDGE_THRESHOLD}px`; overlay.style.height = `${targetRect.height}px`;
        break;
      case "top":
        overlay.style.top = `${top}px`; overlay.style.left = `${left}px`;
        overlay.style.width = `${targetRect.width}px`; overlay.style.height = `${EDGE_THRESHOLD}px`;
        break;
      case "bottom":
        overlay.style.top = `${top + targetRect.height - EDGE_THRESHOLD}px`; overlay.style.left = `${left}px`;
        overlay.style.width = `${targetRect.width}px`; overlay.style.height = `${EDGE_THRESHOLD}px`;
        break;
    }

    state.frameEl.appendChild(overlay);
    edgeSplitPreview = { frameKey, zone, overlay };
    D("edge-highlight", { frame: frameKey, zone });
  }

  let paneCounter = 0;
  function nextPaneKey(): string {
    return `pane-${String(++paneCounter)}`;
  }

  function addChildToFrame(frameKey: string): void {
    const state = frames.get(frameKey);
    if (!state) return;
    const leaf = findLeafContainer(state.rootContainer, state.childContainers);
    if (!leaf) return;
    const key = `entry-${String(Date.now())}-${String(Math.random().toString(36).slice(2, 6))}`;
    const entry: Entry = { key, label: `Tab ${String(leaf.entries.length + 1)}` };
    (entry as any)._content = { type: "html", props: { content: `<div style="padding:12px"><h3>New Tab</h3><p>Empty workspace tab.</p></div>` } };
    leaf.addEntry(entry);
  }

  function createLeafContainer(frameKey: string, entries: Entry[]): Container {
    const callbacks = createTabCallbacksForFrame(frameKey);
    return createContainer({
      entries,
      layout: "tabbed" as Layout,
      contentFactory: wrapContentFactory(frameKey),
      callbacks,
      policy: { allowedLayouts: ["free", "tabbed", "accordion"], maxDepth: 3 },
      onAdd: () => {
        addChildToFrame(frameKey);
      },
      onLayoutChange: (type) => {
        for (const cb of layoutChangeCbs) cb(frameKey, type);
      },
    });
  }

  function createSplitContainer(
    frameKey: string,
    direction: "splith" | "splitv",
    childEntries: Array<{ key: string; child: Container }>,
    state: FrameState,
  ): Container {
    const entries: Entry[] = childEntries.map(({ key }) => ({ key, label: key }));
    for (const { key, child } of childEntries) {
      state.childContainers.set(key, child);
    }

    return createContainer({
      entries,
      layout: direction,
      contentFactory: (entry: Entry) => {
        const child = state.childContainers.get(entry.key);
        if (child) {
          const el = document.createElement("div");
          el.style.cssText = "display:flex;flex-direction:column;height:100%;";
          child.mount(el);
          return { element: el, dispose: () => child.dispose() };
        }
        return { element: document.createElement("div") };
      },
      policy: { allowedLayouts: ["free", "tabbed", "accordion", "splith", "splitv"], maxDepth: 10 },
      onCollapse: (remainingEntry) => {
        const remainingChild = state.childContainers.get(remainingEntry.key);
        if (remainingChild) {
          remainingChild.unmount();
          state.childContainers.delete(remainingEntry.key);
          while (state.tabContentEl.firstChild) {
            state.tabContentEl.removeChild(state.tabContentEl.firstChild);
          }
          state.rootContainer = remainingChild;
          remainingChild.mount(state.tabContentEl);
          D("split-collapse", { frame: frameKey, surviving: remainingEntry.key });
        }
      },
    });
  }

  function handleEmptyLeaf(frameKey: string, leafContainer: Container): void {
    const state = frames.get(frameKey);
    if (!state) return;

    if (leafContainer === state.rootContainer) {
      D("empty-source → remove frame", { frame: frameKey });
      state.rootContainer.dispose();
      state.frameEl.remove();
      frames.delete(frameKey);
      zOrder = zOrder.filter(k => k !== frameKey);
      applyZOrder();
      for (const cb of closeCbs) cb(frameKey);
      return;
    }

    const parentInfo = findParentSplitEntry(state.rootContainer, state.childContainers, leafContainer);
    if (parentInfo) {
      D("empty-source → remove pane", { frame: frameKey, paneKey: parentInfo.entryKey });
      state.childContainers.delete(parentInfo.entryKey);
      parentInfo.parent.removeEntry(parentInfo.entryKey);
    }
  }

  function createTabCallbacksForFrame(frameKey: string): LayoutCallbacks {
    return {
      onEntryReorder(keys) {
        for (const cb of tabReorderCbs) cb(frameKey, keys);
      },
      onTabDragStart(_tabKey, ghost) {
        D("drag-start", { frame: frameKey, tab: _tabKey });
        dragState = { sourceFrame: frameKey, tabKey: _tabKey, ghost };
      },
      onTabDragMove(_tabKey, x, y) {
        handleCrossFrameDragMove(frameKey, x, y);
      },
      onTabDragEnd() {
        if (dragState?.targetFrame) {
          const targetKey = dragState.targetFrame;
          const tabKey = dragState.tabKey;
          const insertIdx = crossFramePreview?.insertIndex ?? -1;
          D("drop-on-strip", { tab: tabKey, from: frameKey, to: targetKey, insertIdx });

          const targetState = frames.get(targetKey);
          const sourceState = frames.get(frameKey);

          cleanupCrossFramePreview();
          cleanupEdgeSplitPreview();
          dragState = null;

          if (sourceState && targetState) {
            const sourceContainer = findContainerWithTab(sourceState.rootContainer, tabKey, sourceState.childContainers);
            if (!sourceContainer) return;
            const entry = sourceContainer.entries.find(e => e.key === tabKey);
            if (!entry) return;

            suppressEntryClose = true;
            sourceContainer.removeEntry(tabKey);
            suppressEntryClose = false;

            const targetLeaf = findDropTargetContainer(targetState);
            if (targetLeaf) {
              const targetIdx = insertIdx >= 0 && insertIdx <= targetLeaf.entries.length
                ? insertIdx : targetLeaf.entries.length;
              targetLeaf.addEntry(entry, targetIdx);

              const targetEl = targetState.tabContentEl;
              const droppedBtn = targetEl.querySelector(
                `[data-tab-key="${entry.key}"]`,
              ) as HTMLElement | null;
              if (droppedBtn) {
                droppedBtn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
                document.dispatchEvent(new PointerEvent("pointerup"));
              }
            }

            D("drop-on-strip done", { tab: tabKey, srcRemaining: sourceContainer.entries.length, tgtTabs: targetLeaf?.entries.length });
            for (const cb of crossFrameDropCbs) cb(frameKey, tabKey, targetKey);

            if (sourceContainer.entries.length === 0) {
              D("source-empty after strip drop", { frame: frameKey });
              handleEmptyLeaf(frameKey, sourceContainer);
            }
          }
        } else if (edgeSplitPreview) {
          const { frameKey: targetFrame, zone } = edgeSplitPreview;
          const tabKey = dragState?.tabKey ?? "";
          D("drop-on-edge", { tab: tabKey, from: frameKey, target: targetFrame, zone });
          cleanupEdgeSplitPreview();
          cleanupCrossFramePreview();
          dragState = null;
          splitFrame(frameKey, tabKey, targetFrame, zone);
          for (const cb of edgeSplitCbs) cb(frameKey, tabKey, targetFrame, zone);
        } else {
          D("drag-cancelled", { frame: frameKey, tab: dragState?.tabKey });
          cleanupCrossFramePreview();
          cleanupEdgeSplitPreview();
          dragState = null;
        }
      },
      onTabDragOut(tabKey, x, y) {
        if (dragState?.targetFrame) return;
        if (edgeSplitPreview) return;
        D("drag-out", { frame: frameKey, tab: tabKey, x: Math.round(x), y: Math.round(y) });
        dragState = null;
        let relX = x;
        let relY = y;
        if (containerEl) {
          const rect = containerEl.getBoundingClientRect();
          relX = x - rect.left;
          relY = y - rect.top;
        }
        for (const cb of tabDragOutCbs) cb(frameKey, tabKey, { x: relX, y: relY });
      },
      onEntryClose(tabKey) {
        if (suppressEntryClose) return;
        D("tab-close", { frame: frameKey, tab: tabKey });
        const state = frames.get(frameKey);
        if (!state) return;
        const leaf = findContainerWithTab(state.rootContainer, tabKey, state.childContainers);
        if (leaf) {
          leaf.removeEntry(tabKey);
          for (const cb of tabRemovedCbs) cb(frameKey, tabKey);
          if (leaf.entries.length === 0 && leaf !== state.rootContainer) {
            handleEmptyLeaf(frameKey, leaf);
          }
        } else {
          for (const cb of tabRemovedCbs) cb(frameKey, tabKey);
        }
      },
    };
  }

  function findDropTargetContainer(state: FrameState): Container | null {
    if (isSplitLayout(state.rootContainer.organiser.type)) {
      return findLeafContainer(state.rootContainer, state.childContainers, (c) => {
        const el = getContainerElement(state, c);
        if (!el) return false;
        return !!el.querySelector("[data-tab-strip] [data-tab-preview]");
      });
    }
    return state.rootContainer;
  }

  function getContainerElement(state: FrameState, container: Container): HTMLElement | null {
    if (container === state.rootContainer) return state.tabContentEl;
    for (const [key, child] of state.childContainers) {
      if (child === container) {
        const pane = state.tabContentEl.querySelector(`[data-split-pane="${key}"]`);
        return pane as HTMLElement | null;
      }
    }
    return null;
  }

  function splitFrame(
    fromFrameKey: string,
    tabKey: string,
    targetFrameKey: string,
    zone: EdgeZone,
  ): void {
    const targetState = frames.get(targetFrameKey);
    if (!targetState) return;

    const sourceState = frames.get(fromFrameKey);
    if (!sourceState) return;

    const sourceContainer = findContainerWithTab(sourceState.rootContainer, tabKey, sourceState.childContainers);
    if (!sourceContainer) return;
    const entryIdx = sourceContainer.entries.findIndex(e => e.key === tabKey);
    if (entryIdx === -1) return;
    const droppedEntry = sourceContainer.entries[entryIdx]!;

    suppressEntryClose = true;
    sourceContainer.removeEntry(tabKey);
    suppressEntryClose = false;

    if (fromFrameKey !== targetFrameKey && sourceContainer.entries.length === 0) {
      handleEmptyLeaf(fromFrameKey, sourceContainer);
    }

    const direction: Layout = (zone === "left" || zone === "right") ? "splith" : "splitv";

    targetState.rootContainer.unmount();

    const originalKey = nextPaneKey();
    const droppedKey = nextPaneKey();

    const droppedContainer = createLeafContainer(targetFrameKey, [droppedEntry]);

    const originalContainer = targetState.rootContainer;

    const children = (zone === "left" || zone === "top")
      ? [{ key: droppedKey, child: droppedContainer }, { key: originalKey, child: originalContainer }]
      : [{ key: originalKey, child: originalContainer }, { key: droppedKey, child: droppedContainer }];

    const splitContainer = createSplitContainer(targetFrameKey, direction as "splith" | "splitv", children, targetState);
    targetState.rootContainer = splitContainer;
    splitContainer.mount(targetState.tabContentEl);

    if (fromFrameKey === targetFrameKey && sourceContainer.entries.length === 0 && sourceContainer !== originalContainer) {
      handleEmptyLeaf(targetFrameKey, sourceContainer);
    }

    D("splitFrame done", { frame: targetFrameKey, dir: direction });
  }

  function handleCrossFrameDragMove(
    sourceFrame: string,
    x: number,
    y: number,
  ): void {
    let foundTarget: string | undefined;

    for (const [key, state] of frames) {
      const strips: HTMLElement[] = [];

      if (isSplitLayout(state.rootContainer.organiser.type)) {
        const dragTabKey = dragState?.tabKey ?? "";
        forEachLeafContainer(state.rootContainer, state.childContainers, (leaf) => {
          if (leaf.entries.some(e => e.key === dragTabKey)) return;
          const el = getContainerElement(state, leaf);
          if (!el) return;
          const strip = el.querySelector("[data-tab-strip]") as HTMLElement | null;
          if (strip) strips.push(strip);
        });
      } else if (key !== sourceFrame) {
        const s = state.tabContentEl.querySelector("[data-tab-strip]") as HTMLElement | null;
        if (s) strips.push(s);
      }

      let matchedStrip: HTMLElement | null = null;
      for (const strip of strips) {
        const rect = strip.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top - 15 && y <= rect.bottom + 15) {
          matchedStrip = strip;
          break;
        }
      }
      if (!matchedStrip) continue;

      foundTarget = key;

      if (!crossFramePreview || crossFramePreview.frameKey !== key) {
        cleanupCrossFramePreview();
        const placeholder = document.createElement("button");
        placeholder.setAttribute("data-tab-preview", "");
        const sourceState = frames.get(sourceFrame);
        let dragEntry: Entry | undefined;
        if (sourceState) {
          const srcContainer = findContainerWithTab(sourceState.rootContainer, dragState?.tabKey ?? "", sourceState.childContainers);
          dragEntry = srcContainer?.entries.find(e => e.key === dragState?.tabKey);
        }
        placeholder.textContent = dragEntry?.label ?? dragState?.tabKey ?? "";
        placeholder.style.cssText =
          "padding:4px 12px;border:none;" +
          "background:var(--pages-surface-3,#333);" +
          "color:var(--pages-text-1,#e0e0e0);" +
          "opacity:0.5;pointer-events:none;" +
          "border-bottom:2px solid transparent;" +
          "transition:all 0.15s ease;";
        matchedStrip.appendChild(placeholder);
        crossFramePreview = { frameKey: key, placeholder, insertIndex: -1 };
      }

      const buttons = [...matchedStrip.querySelectorAll("[data-tab-key]")] as HTMLElement[];
      const placeholder = crossFramePreview!.placeholder;
      let insertBefore: HTMLElement | null = null;
      let idx = buttons.length;
      for (let i = 0; i < buttons.length; i++) {
        const bRect = buttons[i]!.getBoundingClientRect();
        const mid = bRect.left + bRect.width / 2;
        if (x < mid) {
          insertBefore = buttons[i]!;
          idx = i;
          break;
        }
      }
      crossFramePreview!.insertIndex = idx;
      if (insertBefore) {
        matchedStrip.insertBefore(placeholder, insertBefore);
      } else {
        if (placeholder.nextSibling) {
          matchedStrip.appendChild(placeholder);
        }
      }

      break;
    }

    if (!foundTarget) {
      cleanupCrossFramePreview();

      let edgeHit: { frameKey: string; zone: EdgeZone; targetEl: HTMLElement } | null = null;

      for (const [key, state] of frames) {
        if (key === sourceFrame && !isSplitLayout(state.rootContainer.organiser.type) && state.rootContainer.entries.length < 2) continue;

        if (isSplitLayout(state.rootContainer.organiser.type)) {
          forEachLeafContainer(state.rootContainer, state.childContainers, (leaf) => {
            if (edgeHit) return;

            const dragTabKey = dragState?.tabKey ?? "";
            const isSourcePane = leaf.entries.some(e => e.key === dragTabKey);
            if (isSourcePane && leaf.entries.length < 2) return;

            const el = getContainerElement(state, leaf);
            if (!el) return;
            const contentEl = el.querySelector("[data-tab-content]") as HTMLElement | null;
            if (!contentEl) return;

            const contentRect = contentEl.getBoundingClientRect();
            const zone = detectEdgeZone({ x, y }, contentRect, EDGE_THRESHOLD);
            if (zone) {
              edgeHit = { frameKey: key, zone, targetEl: contentEl };
            }
          });
        } else {
          const contentEl = state.tabContentEl.querySelector("[data-tab-content]") as HTMLElement | null;
          if (contentEl) {
            const contentRect = contentEl.getBoundingClientRect();
            const zone = detectEdgeZone({ x, y }, contentRect, EDGE_THRESHOLD);
            if (zone) {
              edgeHit = { frameKey: key, zone, targetEl: contentEl };
            }
          }
        }

        if (edgeHit) break;
      }

      if (edgeHit) {
        showEdgeSplitOverlay(edgeHit.frameKey, edgeHit.zone, edgeHit.targetEl);
      } else {
        cleanupEdgeSplitPreview();
      }
    } else {
      cleanupEdgeSplitPreview();
    }

    if (dragState) dragState.targetFrame = foundTarget ?? undefined;
  }

  function applyZOrder(): void {
    zOrder = zOrder.filter((k) => frames.has(k));
    for (let i = 0; i < zOrder.length; i++) {
      frames.get(zOrder[i]!)!.frameEl.style.zIndex = String(i + 1);
    }
  }

  function bringToFrontInternal(key: string): void {
    zOrder = zOrder.filter((k) => k !== key);
    zOrder.push(key);
    applyZOrder();
  }

  function wrapContentFactory(frameKey: string): SandboxContentFactory {
    return (entry: Entry) => {
      if (!contentFactory) {
        const el = document.createElement("div");
        return { element: el };
      }
      const tabConfig: FrameTabConfig = {
        key: entry.key,
        label: entry.label,
        content: (entry as any)._content ?? { type: "html", props: {} },
      };
      return contentFactory(tabConfig);
    };
  }

  function createFrameElement(
    key: string,
    pos: { x: number; y: number },
    size: { width: number; height: number },
  ): HTMLElement {
    const frame = document.createElement("div");
    frame.setAttribute("data-frame-key", key);
    frame.style.cssText =
      `position:absolute;pointer-events:auto;` +
      `left:${pos.x}px;top:${pos.y}px;` +
      `width:${size.width}px;height:${size.height}px;` +
      `display:flex;flex-direction:column;` +
      `background:var(--pages-neutral-2,#1e1e1e);` +
      `border:1px solid var(--pages-neutral-4,#333);` +
      `border-radius:6px;overflow:hidden;`;
    return frame;
  }

  function createResizeHandles(
    frameEl: HTMLElement,
    state: FrameState,
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
      handle.style.cssText = `position:absolute;z-index:10;cursor:${cursors[dir]};`;

      const sz = "8px";
      const offset = "-3px";
      if (dir.includes("n")) {
        handle.style.top = offset;
        handle.style.height = sz;
      }
      if (dir.includes("s")) {
        handle.style.bottom = offset;
        handle.style.height = sz;
      }
      if (dir.includes("e")) {
        handle.style.right = offset;
        handle.style.width = sz;
      }
      if (dir.includes("w")) {
        handle.style.left = offset;
        handle.style.width = sz;
      }
      if (dir === "n" || dir === "s") {
        handle.style.left = sz;
        handle.style.right = sz;
      }
      if (dir === "e" || dir === "w") {
        handle.style.top = sz;
        handle.style.bottom = sz;
      }
      if (dir.length === 2) {
        handle.style.width = sz;
        handle.style.height = sz;
      }

      handle.addEventListener("pointerdown", (startEvt) => {
        startEvt.stopPropagation();
        startEvt.preventDefault();
        document.body.style.userSelect = "none";
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

          if (dir.includes("e")) newW = Math.max(100, startW + dx);
          if (dir.includes("w")) {
            newW = Math.max(100, startW - dx);
            newX = startLeft + (startW - newW);
          }
          if (dir.includes("s")) newH = Math.max(80, startH + dy);
          if (dir.includes("n")) {
            newH = Math.max(80, startH - dy);
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
          document.body.style.userSelect = "";
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          for (const cb of resizeCbs) cb(state.key, { ...state.size });
        };

        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
      });

      frameEl.appendChild(handle);
    }
  }

  const backend: FloatingFrameBackend = {
    attach(container, factory, options?) {
      containerEl = container;
      contentFactory = factory;
      extraButtons = options?.extraButtons ?? [];
    },

    detach() {
      containerEl = null;
      contentFactory = null;
    },

    renderFrame(layout: FrameLayout) {
      if (!containerEl) return;
      D("frame-create", { key: layout.key, tabs: layout.tabs.map(t => t.label) });

      const frameEl = createFrameElement(
        layout.key,
        layout.position,
        layout.size,
      );

      frameEl.addEventListener(
        "pointerdown",
        () => bringToFrontInternal(layout.key),
        { capture: true },
      );

      const titlebar = document.createElement("div");
      titlebar.setAttribute("data-frame-titlebar", "");
      titlebar.style.cssText =
        "display:flex;align-items:center;padding:4px 8px;" +
        "background:var(--pages-surface-2,#2a2a2a);cursor:grab;" +
        "user-select:none;border-bottom:1px solid var(--pages-border-1,#333);";

      const tabContentEl = document.createElement("div");
      tabContentEl.style.cssText =
        "flex:1;display:flex;flex-direction:column;overflow:hidden;";

      const tabEntries: Entry[] = layout.tabs.map((tab) => {
        const entry: Entry & { _content?: unknown } = {
          key: tab.key,
          label: tab.label,
        };
        (entry as any)._content = tab.content;
        return entry;
      });

      const initialLayout: Layout = layout.viewMode === "accordion" ? "accordion" : "tabbed";

      const state: FrameState = {
        key: layout.key,
        position: { ...layout.position },
        size: { ...layout.size },
        frameEl,
        rootContainer: null!,
        tabContentEl,
        childContainers: new Map(),
      };

      const rootContainer = createContainer({
        entries: tabEntries,
        layout: initialLayout,
        contentFactory: wrapContentFactory(layout.key),
        callbacks: createTabCallbacksForFrame(layout.key),
        policy: { allowedLayouts: ["free", "tabbed", "accordion"], maxDepth: 3 },
        onAdd: () => { addChildToFrame(layout.key); },
        onLayoutChange: (type) => {
          for (const cb of layoutChangeCbs) cb(layout.key, type);
        },
      });

      (state as { rootContainer: Container }).rootContainer = rootContainer;

      titlebar.addEventListener("pointerdown", (startEvt) => {
        if (
          (startEvt.target as HTMLElement).closest(
            ".frame-close-dot, .frame-pin-btn, .frame-extra-btn, .frame-detach-dot",
          )
        )
          return;
        startEvt.preventDefault();
        document.body.style.userSelect = "none";
        const startX = startEvt.clientX;
        const startY = startEvt.clientY;
        const startLeft = state.position.x;
        const startTop = state.position.y;

        const onMove = (e: PointerEvent) => {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          state.position = { x: startLeft + dx, y: startTop + dy };
          frameEl.style.left = `${state.position.x}px`;
          frameEl.style.top = `${state.position.y}px`;
          for (const cb of dragMoveCbs)
            cb(layout.key, { ...state.position });
        };

        const onUp = () => {
          document.body.style.userSelect = "";
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          for (const cb of moveCbs) cb(layout.key, { ...state.position });
        };

        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
      });

      frameEl.appendChild(titlebar);
      frameEl.appendChild(tabContentEl);

      rootContainer.mount(tabContentEl);

      // Inject ☰ and + buttons into the tab strip (D16: single row)
      const strip = tabContentEl.querySelector("[data-tab-strip]") as HTMLElement | null;
      if (strip) {
        const actions = document.createElement("span");
        actions.setAttribute("data-toolbar-actions", "");
        actions.style.cssText = "margin-left:auto;display:flex;align-items:center;gap:2px;";

        const modeBtn = document.createElement("span");
        modeBtn.setAttribute("data-toolbar-mode", "");
        modeBtn.textContent = "☰";
        modeBtn.title = "Cycle view mode";
        modeBtn.style.cssText = "cursor:pointer;padding:2px 6px;font-size:12px;opacity:0.5;";
        modeBtn.addEventListener("mouseenter", () => { modeBtn.style.opacity = "1"; });
        modeBtn.addEventListener("mouseleave", () => { modeBtn.style.opacity = "0.5"; });
        modeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const currentType = state.rootContainer.organiser.type;
          const modes: Layout[] = ["tabbed", "accordion"];
          const idx = modes.indexOf(currentType);
          const next = modes[(idx + 1) % modes.length]!;
          try { state.rootContainer.setLayout(next); } catch { /* not allowed */ }
        });

        const addBtn = document.createElement("span");
        addBtn.setAttribute("data-toolbar-add", "");
        addBtn.textContent = "+";
        addBtn.title = "Add tab";
        addBtn.style.cssText = "cursor:pointer;padding:2px 6px;font-size:14px;font-weight:bold;opacity:0.5;";
        addBtn.addEventListener("mouseenter", () => { addBtn.style.opacity = "1"; });
        addBtn.addEventListener("mouseleave", () => { addBtn.style.opacity = "0.5"; });
        addBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          addChildToFrame(layout.key);
        });

        actions.appendChild(modeBtn);
        actions.appendChild(addBtn);
        strip.appendChild(actions);
      }

      // In tabbed mode, strip actions (☰ +) handle everything — hide the
      // Container's built-in toolbar to avoid a duplicate + that misleadingly
      // adds a sibling tab instead of a nested child. The Container toolbar
      // re-appears in accordion/free mode where it adds layout-appropriate children.
      const builtinToolbar = tabContentEl.querySelector("[data-container-toolbar]") as HTMLElement | null;
      if (builtinToolbar && initialLayout === "tabbed") {
        builtinToolbar.style.display = "none";
      }

      if (layout.activeTabKey) {
        const btns = tabContentEl.querySelectorAll("[data-tab-key]");
        for (const btn of btns) {
          if (btn.getAttribute("data-tab-key") === layout.activeTabKey) {
            (btn as HTMLElement).dispatchEvent(
              new PointerEvent("pointerdown", { bubbles: true }),
            );
            document.dispatchEvent(new PointerEvent("pointerup"));
            break;
          }
        }
      }

      injectFrameChrome(
        frameEl,
        titlebar,
        {
          onClose: () => {
            for (const cb of closeCbs) cb(layout.key);
          },
          onPin: () => {
            for (const cb of pinCbs) cb(layout.key);
          },
          onDetach: () => {
            for (const cb of detachCbs) cb(layout.key);
          },
          onTitlebarDoubleClick: () => {
            for (const cb of dblClickCbs) cb(layout.key);
          },
        },
        extraButtons.map((btn) => ({
          icon: btn.icon,
          title: btn.title,
          className: btn.className,
          onClick: () => btn.onClick(layout.key),
        })),
      );

      createResizeHandles(frameEl, state);

      frames.set(layout.key, state);
      zOrder.push(layout.key);
      containerEl.appendChild(frameEl);
      applyZOrder();
    },

    removeFrame(key) {
      const state = frames.get(key);
      if (!state) return;
      D("frame-remove", { key });
      state.rootContainer.dispose();
      for (const child of state.childContainers.values()) {
        child.dispose();
      }
      state.childContainers.clear();
      state.frameEl.remove();
      frames.delete(key);
      zOrder = zOrder.filter((k) => k !== key);
      applyZOrder();
    },

    updatePosition(key, pos) {
      const state = frames.get(key);
      if (!state) return;
      state.position = { ...pos };
      state.frameEl.style.left = `${pos.x}px`;
      state.frameEl.style.top = `${pos.y}px`;
    },

    updateSize(key, size) {
      const state = frames.get(key);
      if (!state) return;
      state.size = { ...size };
      state.frameEl.style.width = `${size.width}px`;
      state.frameEl.style.height = `${size.height}px`;
    },

    bringToFront(key) {
      bringToFrontInternal(key);
    },

    addTab(frameKey, tab) {
      const state = frames.get(frameKey);
      if (!state) return;
      D("tab-add", { frame: frameKey, tab: tab.label || tab.key });
      const entry: Entry & { _content?: unknown } = {
        key: tab.key,
        label: tab.label,
      };
      (entry as any)._content = tab.content;

      const leaf = findLeafContainer(state.rootContainer, state.childContainers);
      if (leaf) {
        leaf.addEntry(entry);
        const btn = state.tabContentEl.querySelector(
          `[data-tab-key="${tab.key}"]`,
        ) as HTMLElement | null;
        if (btn) {
          btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
          document.dispatchEvent(new PointerEvent("pointerup"));
        }
      }
    },

    removeTab(frameKey, tabKey) {
      const state = frames.get(frameKey);
      if (!state) return;
      D("tab-remove (backend)", { frame: frameKey, tab: tabKey });
      suppressEntryClose = true;
      const leaf = findContainerWithTab(state.rootContainer, tabKey, state.childContainers);
      if (leaf) {
        leaf.removeEntry(tabKey);
        if (leaf.entries.length === 0 && leaf !== state.rootContainer) {
          handleEmptyLeaf(frameKey, leaf);
        }
      }
      suppressEntryClose = false;
    },

    setActiveTab(frameKey, tabKey) {
      const state = frames.get(frameKey);
      if (!state) return;
      const btn = state.tabContentEl.querySelector(
        `[data-tab-key="${tabKey}"]`,
      ) as HTMLElement | null;
      if (btn) {
        btn.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true }),
        );
        document.dispatchEvent(new PointerEvent("pointerup"));
      }
    },

    onFrameMove(cb) {
      moveCbs.push(cb);
    },
    onFrameResize(cb) {
      resizeCbs.push(cb);
    },
    onTabDragOut(cb) {
      tabDragOutCbs.push(cb);
    },
    onTabReorder(cb) {
      tabReorderCbs.push(cb);
    },
    onFrameClose(cb) {
      closeCbs.push(cb);
    },
    onFramePin(cb) {
      pinCbs.push(cb);
    },
    onFrameDragMove(cb) {
      dragMoveCbs.push(cb);
    },
    onTitlebarDoubleClick(cb) {
      dblClickCbs.push(cb);
    },
    onViewModeToggle(cb) {
      viewModeCbs.push(cb);
    },
    onAddTab(cb) {
      addTabCbs.push(cb);
    },
    onTabRemoved(cb) {
      tabRemovedCbs.push(cb);
    },
    onArrangement(cb) {
      arrangementCbs.push(cb);
    },
    onDetach(cb) {
      detachCbs.push(cb);
    },
    onCrossFrameDrop(cb) {
      crossFrameDropCbs.push(cb);
    },
    onEdgeSplit(cb) {
      edgeSplitCbs.push(cb);
    },
    onLayoutChange(cb) {
      layoutChangeCbs.push(cb);
    },

    setFrameLayout(frameKey, layout) {
      const state = frames.get(frameKey);
      if (!state) return;
      const leaf = findLeafContainer(state.rootContainer, state.childContainers);
      if (leaf) {
        try { leaf.setLayout(layout as Layout); } catch { /* layout not allowed by policy */ }
      }
    },

    updatePinState(key, pinned) {
      const state = frames.get(key);
      if (!state) return;
      updatePinVisual(state.frameEl, pinned);
    },

    getFrameElement(key) {
      return frames.get(key)?.frameEl ?? null;
    },

    getSubFrameElements(_frameKey) {
      return [];
    },

    getTabContentElement(frameKey, tabKey) {
      const state = frames.get(frameKey);
      if (!state) return null;
      const leaf = findContainerWithTab(state.rootContainer, tabKey, state.childContainers);
      if (!leaf) return null;
      const entry = leaf.entries.find(e => e.key === tabKey);
      return entry?.contentElement ?? null;
    },

    dispose() {
      for (const state of frames.values()) {
        state.rootContainer.dispose();
        for (const child of state.childContainers.values()) {
          child.dispose();
        }
        state.childContainers.clear();
        state.frameEl.remove();
      }
      frames.clear();
      zOrder = [];
    },

    unwrap() {
      return null;
    },
  };

  return backend;
}
