import { describe, it, expect } from "vitest";
import { migrateFrameLayout } from "./layout-migration.js";
import type { FrameLayout, ContainerState } from "@casehubio/pages-component";
import type { FreeLayoutState } from "./frame-sandbox/types.js";

describe("migrateFrameLayout", () => {
  it("converts single frame to root free container with tabbed child", () => {
    const frames: FrameLayout[] = [
      {
        key: "f1",
        tabs: [{ key: "t1", label: "T1", content: { type: "html", props: {} } }],
        position: { x: 50, y: 50 },
        size: { width: 300, height: 200 },
        order: 0,
        zIndex: 1,
        pinned: false,
        hidden: false,
        activeTabKey: "t1",
      },
    ];
    const state = migrateFrameLayout(frames);

    expect(state.layout).toBe("free");
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]!.key).toBe("f1");
    expect(state.tabs[0]!.children!.layout).toBe("tabbed");
    expect(state.tabs[0]!.children!.tabs).toHaveLength(1);
    expect(state.tabs[0]!.children!.tabs[0]!.key).toBe("t1");

    const layoutState = state.layoutState as FreeLayoutState;
    expect(layoutState.entries["f1"]!.position).toEqual({ x: 50, y: 50 });
    expect(layoutState.entries["f1"]!.size).toEqual({ width: 300, height: 200 });
  });

  it("preserves tab active key in child layout state", () => {
    const frames: FrameLayout[] = [
      {
        key: "f1",
        tabs: [
          { key: "t1", label: "T1", content: { type: "html", props: {} } },
          { key: "t2", label: "T2", content: { type: "html", props: {} } },
        ],
        position: { x: 0, y: 0 },
        size: { width: 400, height: 300 },
        order: 0,
        zIndex: 1,
        pinned: false,
        hidden: false,
        activeTabKey: "t2",
      },
    ];
    const state = migrateFrameLayout(frames);
    const childState = state.tabs[0]!.children!;

    expect(childState.layoutState).toEqual({
      activeKey: "t2",
      order: ["t1", "t2"],
    });
  });

  it("sorts frames by order and zOrder by zIndex", () => {
    const frames: FrameLayout[] = [
      {
        key: "f2",
        tabs: [{ key: "t2", label: "T2", content: null }],
        position: { x: 400, y: 0 },
        size: { width: 300, height: 200 },
        order: 1,
        zIndex: 2,
        pinned: false,
        hidden: false,
        activeTabKey: "t2",
      },
      {
        key: "f1",
        tabs: [{ key: "t1", label: "T1", content: null }],
        position: { x: 0, y: 0 },
        size: { width: 300, height: 200 },
        order: 0,
        zIndex: 1,
        pinned: false,
        hidden: false,
        activeTabKey: "t1",
      },
    ];
    const state = migrateFrameLayout(frames);

    expect(state.tabs[0]!.key).toBe("f1");
    expect(state.tabs[1]!.key).toBe("f2");

    const layoutState = state.layoutState as FreeLayoutState;
    expect(layoutState.zOrder).toEqual(["f1", "f2"]);
  });

  it("preserves existing containerTree when present", () => {
    const containerTree: ContainerState = {
      layout: "splith",
      tabs: [
        { key: "left", label: "Left", content: { type: "html", props: {} } },
        { key: "right", label: "Right", content: { type: "html", props: {} } },
      ],
    };
    const frames: FrameLayout[] = [
      {
        key: "f1",
        tabs: [{ key: "t1", label: "T1", content: null }],
        position: { x: 0, y: 0 },
        size: { width: 600, height: 400 },
        order: 0,
        zIndex: 1,
        pinned: false,
        hidden: false,
        activeTabKey: "t1",
        containerTree,
      },
    ];
    const state = migrateFrameLayout(frames);

    expect(state.tabs[0]!.children).toBe(containerTree);
  });

  it("returns empty tabs and entries for empty input", () => {
    const state = migrateFrameLayout([]);

    expect(state.layout).toBe("free");
    expect(state.tabs).toHaveLength(0);

    const layoutState = state.layoutState as FreeLayoutState;
    expect(Object.keys(layoutState.entries)).toHaveLength(0);
    expect(layoutState.zOrder).toHaveLength(0);
  });

  it("uses first tab label as frame label", () => {
    const frames: FrameLayout[] = [
      {
        key: "f1",
        tabs: [
          { key: "t1", label: "My Panel", content: null },
          { key: "t2", label: "Second", content: null },
        ],
        position: { x: 0, y: 0 },
        size: { width: 300, height: 200 },
        order: 0,
        zIndex: 1,
        pinned: false,
        hidden: false,
        activeTabKey: "t1",
      },
    ];
    const state = migrateFrameLayout(frames);

    expect(state.tabs[0]!.label).toBe("My Panel");
  });
});
