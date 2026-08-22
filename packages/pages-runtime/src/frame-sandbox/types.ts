export type Layout = "free" | "tabbed" | "accordion" | "splith" | "splitv" | "content";

export interface ContainerPolicy {
  readonly allowedLayouts: readonly Layout[];
  readonly maxDepth: number;
}

export const DEFAULT_POLICY: ContainerPolicy = {
  allowedLayouts: ["free", "tabbed", "accordion"],
  maxDepth: 3,
};

export interface PerLayoutMeta {
  free?: { x: number; y: number; width: number; height: number };
  accordion?: { height: number; collapsed: boolean };
}

export interface Entry {
  readonly key: string;
  readonly label: string;
  contentElement?: HTMLElement | undefined;
  contentDispose?: (() => void) | undefined;
  meta?: PerLayoutMeta;
}

export type ContentFactory = (entry: Entry) => {
  element: HTMLElement;
  dispose?: () => void;
};

export interface TabState {
  activeKey: string;
  order: string[];
}

export interface AccordionState {
  collapsed: string[];
  heights: Record<string, number>;
}

export interface FreeLayoutEntry {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface FreeLayoutState {
  entries: Record<string, FreeLayoutEntry>;
  zOrder: string[];
}

export interface SplitState {
  ratios: number[];
}

export interface LayoutCallbacks {
  onEntryClose?: (key: string) => void;
  onEntryReorder?: (keys: string[]) => void;
  onTabDragOut?: (key: string, x: number, y: number) => void;
  onTabDragStart?: (key: string, ghost: HTMLElement) => void;
  onTabDragMove?: (key: string, x: number, y: number) => void;
  onTabDragEnd?: () => void;
  onStateChange?: () => void;
  onEntryMove?: (key: string, x: number, y: number) => void;
  onEntryResize?: (key: string, w: number, h: number) => void;
}

export interface LayoutStrategy {
  readonly type: Layout;
  mount(
    container: HTMLElement,
    entries: Entry[],
    factory: ContentFactory,
  ): void;
  unmount(): void;
  addEntry(entry: Entry, atIndex?: number): void;
  removeEntry(key: string): void;
  getState(): TabState | AccordionState | FreeLayoutState | SplitState;
  restoreState(state: unknown): void;
  dispose(): void;
}
