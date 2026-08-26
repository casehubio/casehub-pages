import type { ContentFactory, FrameLayout, ContainerState } from "@casehubio/pages-component";
import { createFrameDetachHandler, type FrameDetachHandler } from "./frame-detach-handler.js";
import { migrateFrameLayout } from "./layout-migration.js";
import { injectAnimationStyles } from "./frame-animations.js";
import {
  createContainerToolbar,
  type ContainerToolbar,
} from "./frame-sandbox/container-toolbar";
import type { Layout, Entry, Container, FreeLayoutState } from "./frame-sandbox/types.js";
import { SPLIT_POLICY } from "./frame-sandbox/types.js";
import { createContainer, containerizeEntry } from "./frame-sandbox/index.js";
import { captureContainerState, findContainerWithTab } from "./container-tree-ops.js";

export interface WireOptions {
  readonly detachEnabled?: boolean | undefined;
  readonly contentFactory?: ContentFactory | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly existingContainer?: Container | undefined;
}

export interface WireHandle {
  readonly rootContainer: Container;
  readonly detachHandler?: FrameDetachHandler | undefined;
  readonly containerToolbar?: ContainerToolbar | undefined;
  captureState(): ContainerState;
  dispose(): void;
}

export function wireFloatingWorkspace(
  hostElement: HTMLElement,
  savedLayout?: ContainerState | readonly FrameLayout[],
  options?: WireOptions,
): WireHandle {
  injectAnimationStyles();

  let containerState: ContainerState | undefined;
  if (savedLayout) {
    containerState = Array.isArray(savedLayout)
      ? migrateFrameLayout(savedLayout as readonly FrameLayout[])
      : savedLayout as ContainerState;
  }

  const externalFactory = options?.contentFactory;

  function addNestButton(wrapper: HTMLElement, entry: Entry): void {
    if (entry.childContainer) return;
    const btn = document.createElement("button");
    btn.setAttribute("data-nest-button", "");
    btn.setAttribute("role", "button");
    btn.setAttribute("aria-label", "Nest content into tabbed container");
    btn.textContent = "⊞";
    btn.title = "Nest";
    btn.style.cssText = "position:absolute;bottom:8px;right:8px;z-index:10;padding:4px 8px;border:1px solid var(--pages-border-1,#333);background:var(--pages-surface-2,#222);color:var(--pages-text-2,#aaa);border-radius:4px;cursor:pointer;font-size:14px;opacity:0.5;transition:opacity 0.15s ease;";
    btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
    btn.addEventListener("mouseleave", () => { btn.style.opacity = "0.5"; });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const parentContainer = findContainerWithTab(rootContainer, entry.key);
      if (!parentContainer) return;
      try {
        containerizeEntry(entry, parentContainer, entryContentFactory);
      } catch { return; }
      btn.remove();
      while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);
      if (entry.childContainer) {
        const el = document.createElement("div");
        el.style.cssText = "display:flex;flex-direction:column;height:100%;";
        entry.childContainer.mount(el);
        wrapper.appendChild(el);
      }
    });
    wrapper.appendChild(btn);
  }

  function entryContentFactory(entry: Entry): { element: HTMLElement; dispose?: () => void } {
    if (entry.childContainer) {
      const el = document.createElement("div");
      el.style.cssText = "display:flex;flex-direction:column;height:100%;";
      entry.childContainer.mount(el);
      const child = entry.childContainer;
      return { element: el, dispose: () => { child.unmount(); } };
    }
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:relative;height:100%;overflow:auto;";
    if (entry.component && externalFactory) {
      const result = externalFactory({ key: entry.key, label: entry.label, content: entry.component });
      wrapper.appendChild(result.element);
      addNestButton(wrapper, entry);
      const ret: { element: HTMLElement; dispose?: () => void } = { element: wrapper };
      if (result.dispose) ret.dispose = result.dispose;
      return ret;
    }
    const el = document.createElement("div");
    el.style.cssText = "padding:12px;";
    el.textContent = entry.label;
    wrapper.appendChild(el);
    addNestButton(wrapper, entry);
    return { element: wrapper };
  }

  function restoreChild(state: ContainerState): Container {
    const entries: Entry[] = state.tabs.map(tab => {
      const entry: Entry = { key: tab.key, label: tab.label };
      if (tab.children) entry.childContainer = restoreChild(tab.children);
      else entry.component = tab.content ?? undefined;
      return entry;
    });
    const child = createContainer({
      entries,
      layout: "tabbed",
      contentFactory: entryContentFactory,
      policy: SPLIT_POLICY,
      depth: 2,
    });
    if (state.layout !== "tabbed") {
      try { child.setLayout(state.layout); } catch { /* not allowed */ }
    }
    if (state.layoutState) child.organiser.restoreState(state.layoutState);
    return child;
  }

  let rootContainer: Container;

  if (options?.existingContainer) {
    rootContainer = options.existingContainer;
    rootContainer.mount(hostElement);
  } else {
    const rootEntries: Entry[] = (containerState?.tabs ?? []).map(tab => {
      const entry: Entry = { key: tab.key, label: tab.label };
      if (tab.children) entry.childContainer = restoreChild(tab.children);
      else entry.component = tab.content ?? undefined;
      return entry;
    });

    rootContainer = createContainer({
      entries: rootEntries,
      layout: "free",
      contentFactory: entryContentFactory,
      policy: { allowedLayouts: ["free", "tabbed", "accordion"], maxDepth: 5 },
      showToolbar: false,
      ...(containerState?.layoutState ? { freeLayoutState: containerState.layoutState as FreeLayoutState } : {}),
    });
    rootContainer.mount(hostElement);
  }

  let detachHandler: FrameDetachHandler | undefined;
  if (options?.detachEnabled !== false && externalFactory && options?.signal) {
    detachHandler = createFrameDetachHandler(rootContainer, hostElement, externalFactory, options.signal);
  }

  const containerToolbar = createContainerToolbar(
    ["free", "tabbed", "accordion"] as readonly Layout[],
    "free" as Layout,
    {
      onAdd: () => {
        const frameKey = `frame-${String(Date.now())}-${Math.random().toString(36).slice(2, 6)}`;
        rootContainer.addEntry({
          key: frameKey,
          label: "New Frame",
          component: { type: "html" as const, props: { content: `<div style="padding:12px"><h3>New Frame</h3><p>Empty workspace frame.</p></div>` } },
        });
      },
      onLayoutChange: (type) => { rootContainer.setLayout(type); },
      onArrange: (preset) => { rootContainer.organiser.arrange?.(preset); },
    },
  );

  return {
    rootContainer,
    detachHandler,
    containerToolbar,
    captureState(): ContainerState {
      return captureContainerState(rootContainer);
    },
    dispose() {
      containerToolbar.dispose();
      detachHandler?.dispose();
      rootContainer.dispose();
    },
  };
}
