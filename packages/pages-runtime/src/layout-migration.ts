import type { FrameLayout, ContainerState } from "@casehubio/pages-component";
import type { FreeLayoutState, FreeLayoutEntry } from "./frame-sandbox/types.js";

export function migrateFrameLayout(frames: readonly FrameLayout[]): ContainerState {
  const sorted = [...frames].sort((a, b) => a.order - b.order);

  const tabs = sorted.map(frame => ({
    key: frame.key,
    label: frame.tabs[0]?.label ?? frame.key,
    content: null as null,
    children: frame.containerTree ?? {
      layout: "tabbed" as const,
      tabs: frame.tabs.map(t => ({
        key: t.key,
        label: t.label,
        content: t.content,
        children: t.children,
      })),
      layoutState: {
        activeKey: frame.activeTabKey,
        order: frame.tabs.map(t => t.key),
      },
    },
  }));

  const entries: Record<string, FreeLayoutEntry> = {};
  for (const frame of sorted) {
    entries[frame.key] = {
      position: { x: frame.position.x, y: frame.position.y },
      size: { width: frame.size.width, height: frame.size.height },
    };
  }

  const zOrder = [...frames]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map(f => f.key);

  const layoutState: FreeLayoutState = { entries, zOrder };

  return { layout: "free", tabs, layoutState };
}
