import type {
  Entry,
  ContentFactory,
  LayoutStrategy,
  Layout,
  ContainerPolicy,
  LayoutCallbacks,
  FreeLayoutState,
} from "./types.js";
import { DEFAULT_POLICY } from "./types.js";
import { createTabbedStrategy } from "./tabbed-strategy";
import { createAccordionStrategy } from "./accordion-strategy";
import { createFreeLayoutStrategy } from "./free-layout-strategy";
import { createSplitStrategy } from "./split-strategy";
import {
  createContainerToolbar,
  type ContainerToolbar,
} from "./container-toolbar";

export type { Entry, ContentFactory } from "./types.js";

export interface Container {
  readonly entries: readonly Entry[];
  readonly organiser: LayoutStrategy;
  readonly policy: ContainerPolicy;
  readonly depth: number;
  addEntry(entry: Entry, atIndex?: number): void;
  removeEntry(key: string): void;
  replaceChild(oldKey: string, newChild: Entry): void;
  setLayout(type: Layout): void;
  mount(container: HTMLElement): void;
  unmount(): void;
  dispose(): void;
}

export interface ContainerConfig {
  entries: Entry[];
  layout: Layout;
  policy?: ContainerPolicy;
  contentFactory: ContentFactory;
  callbacks?: LayoutCallbacks;
  depth?: number;
  freeLayoutState?: FreeLayoutState;
  onCollapse?: (remainingChild: Entry) => void;
  onAdd?: () => void;
  onLayoutChange?: (type: Layout) => void;
}

function createContentOrganiser(): LayoutStrategy {
  let mountedContainer: HTMLElement | null = null;

  return {
    type: "content" as Layout,
    mount(container, entries, factory) {
      mountedContainer = container;
      for (const entry of entries) {
        if (!entry.contentElement) {
          const result = factory(entry);
          entry.contentElement = result.element;
          entry.contentDispose = result.dispose;
        }
        container.appendChild(entry.contentElement);
      }
    },
    unmount() {
      if (mountedContainer) mountedContainer.innerHTML = "";
      mountedContainer = null;
    },
    addEntry() {},
    removeEntry() {},
    getState() {
      return {} as never;
    },
    restoreState() {},
    dispose() {
      mountedContainer = null;
    },
  };
}

function buildOrganiser(
  type: Layout,
  callbacks?: LayoutCallbacks,
  freeLayoutState?: FreeLayoutState,
  onCollapse?: (remainingChild: Entry) => void,
): LayoutStrategy {
  switch (type) {
    case "tabbed":
      return createTabbedStrategy(callbacks);
    case "accordion":
      return createAccordionStrategy(callbacks);
    case "free":
      return createFreeLayoutStrategy(freeLayoutState, callbacks);
    case "splith":
      return createSplitStrategy("horizontal", { ...callbacks, ...(onCollapse ? { onCollapse } : {}) });
    case "splitv":
      return createSplitStrategy("vertical", { ...callbacks, ...(onCollapse ? { onCollapse } : {}) });
    case "content":
      return createContentOrganiser();
  }
}

export function createContainer(config: ContainerConfig): Container {
  const policy = config.policy ?? DEFAULT_POLICY;
  const depth = config.depth ?? 1;
  const entries: Entry[] = [...config.entries];
  let containerEl: HTMLElement | null = null;
  let organiserContainer: HTMLElement | null = null;
  let toolbar: ContainerToolbar | null = null;
  const factory = config.contentFactory;
  const savedStates = new Map<Layout, unknown>();

  function savePerChildMeta(layout: Layout): void {
    if (layout === "free") {
      const state = currentOrganiser.getState() as import("./types.js").FreeLayoutState;
      for (const entry of entries) {
        const s = state.entries[entry.key];
        if (s) {
          if (!entry.meta) entry.meta = {};
          entry.meta.free = { x: s.position.x, y: s.position.y, width: s.size.width, height: s.size.height };
        }
      }
    } else if (layout === "accordion") {
      const state = currentOrganiser.getState() as import("./types.js").AccordionState;
      for (const entry of entries) {
        if (!entry.meta) entry.meta = {};
        entry.meta.accordion = {
          height: state.heights[entry.key] ?? 0,
          collapsed: state.collapsed.includes(entry.key),
        };
      }
    }
  }

  function wrappedCallbacks(): LayoutCallbacks | undefined {
    if (!config.callbacks) return { onStateChange: () => injectToolbar() };
    return {
      ...config.callbacks,
      onStateChange: () => {
        config.callbacks?.onStateChange?.();
        injectToolbar();
      },
    };
  }

  let currentOrganiser = buildOrganiser(config.layout, wrappedCallbacks(), config.freeLayoutState, config.onCollapse);

  if (depth > policy.maxDepth) {
    throw new Error(
      `Cannot create group at depth ${depth} — ` +
        `maximum nesting depth is ${policy.maxDepth}`,
    );
  }

  function mountOrganiserInto(container: HTMLElement): void {
    organiserContainer = document.createElement("div");
    organiserContainer.style.cssText = "flex:1;min-height:0;position:relative;";
    container.appendChild(organiserContainer);
    currentOrganiser.mount(organiserContainer, entries, factory);
  }

  function injectToolbar(): void {
    if (!toolbar || !organiserContainer) return;
    const tabContent = organiserContainer.querySelector(":scope > [data-tab-content]");
    if (tabContent) {
      tabContent.insertBefore(toolbar.element, tabContent.firstChild);
    } else {
      organiserContainer.insertBefore(toolbar.element, organiserContainer.firstChild);
    }
  }

  const group: Container = {
    get entries() {
      return entries;
    },
    get organiser() {
      return currentOrganiser;
    },
    get policy() {
      return policy;
    },
    get depth() {
      return depth;
    },

    addEntry(entry, atIndex?) {
      if (atIndex !== undefined && atIndex >= 0 && atIndex < entries.length) {
        entries.splice(atIndex, 0, entry);
      } else {
        entries.push(entry);
      }
      currentOrganiser.addEntry(entry, atIndex);
    },

    replaceChild(oldKey, newChild) {
      const idx = entries.findIndex(e => e.key === oldKey);
      if (idx === -1) throw new Error(`Child "${oldKey}" not found`);
      const old = entries[idx]!;
      currentOrganiser.removeEntry(oldKey);
      if (old.contentDispose) old.contentDispose();
      entries[idx] = newChild;
      currentOrganiser.addEntry(newChild);
    },

    removeEntry(key) {
      const idx = entries.findIndex((e) => e.key === key);
      if (idx === -1) return;
      currentOrganiser.removeEntry(key);
      entries.splice(idx, 1);
    },

    setLayout(type) {
      if (!policy.allowedLayouts.includes(type)) {
        throw new Error(
          `Organiser "${type}" not allowed by policy. ` +
            `Allowed: ${policy.allowedLayouts.join(", ")}`,
        );
      }
      if (type === currentOrganiser.type) return;

      savedStates.set(currentOrganiser.type, currentOrganiser.getState());
      savePerChildMeta(currentOrganiser.type);
      currentOrganiser.unmount();
      currentOrganiser = buildOrganiser(type, wrappedCallbacks(), undefined, config.onCollapse);
      if (organiserContainer) {
        const saved = savedStates.get(type);
        if (saved) currentOrganiser.restoreState(saved);
        currentOrganiser.mount(organiserContainer, entries, factory);
      }
      toolbar?.setActive(type);
      injectToolbar();
      config.onLayoutChange?.(type);
    },

    mount(container) {
      containerEl = container;
      container.style.cssText = "display:flex;flex-direction:column;height:100%;";

      mountOrganiserInto(container);

      toolbar = createContainerToolbar(
        policy.allowedLayouts,
        currentOrganiser.type as Layout,
        {
          onAdd: config.onAdd ?? (() => {
            const key = `entry-${String(Date.now())}-${String(Math.random().toString(36).slice(2, 6))}`;
            const entry: Entry = { key, label: `Tab ${String(entries.length + 1)}` };
            group.addEntry(entry);
          }),
          onLayoutChange: (type) => {
            group.setLayout(type);
          },
        },
      );
      injectToolbar();
    },

    unmount() {
      currentOrganiser.unmount();
      toolbar?.dispose();
      toolbar = null;
      organiserContainer?.remove();
      organiserContainer = null;
      if (containerEl) containerEl.style.cssText = "";
      containerEl = null;
    },

    dispose() {
      currentOrganiser.dispose();
      toolbar?.dispose();
      toolbar = null;
      organiserContainer?.remove();
      organiserContainer = null;
      containerEl = null;
    },
  };

  return group;
}
