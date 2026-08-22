import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createFreeLayoutStrategy } from "./free-layout-strategy";
import type { Entry, ContentFactory, FreeLayoutState } from "./types.js";

function testFactory(): ContentFactory {
  return (entry) => {
    const el = document.createElement("div");
    el.textContent = `Content: ${entry.key}`;
    el.dataset.testKey = entry.key;
    return { element: el, dispose: () => el.remove() };
  };
}

function makeEntries(...keys: string[]): Entry[] {
  return keys.map((key) => ({ key, label: key.toUpperCase() }));
}

describe("FreeLayoutOrganiser", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.style.cssText = "width:800px;height:600px;position:relative;";
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("mounts entries as positioned frames", () => {
    const org = createFreeLayoutStrategy({
      entries: {
        a: {
          position: { x: 50, y: 50 },
          size: { width: 300, height: 200 },
        },
        b: {
          position: { x: 400, y: 100 },
          size: { width: 250, height: 180 },
        },
      },
      zOrder: ["a", "b"],
    });
    org.mount(container, makeEntries("a", "b"), testFactory());

    const frames = container.querySelectorAll("[data-frame-key]");
    expect(frames).toHaveLength(2);

    const frameA = container.querySelector(
      "[data-frame-key='a']",
    ) as HTMLElement;
    expect(frameA.style.left).toBe("50px");
    expect(frameA.style.top).toBe("50px");
    expect(frameA.style.width).toBe("300px");
    expect(frameA.style.height).toBe("200px");
  });

  it("each frame has a titlebar and content area", () => {
    const org = createFreeLayoutStrategy({
      entries: {
        a: {
          position: { x: 0, y: 0 },
          size: { width: 200, height: 150 },
        },
      },
      zOrder: ["a"],
    });
    org.mount(container, makeEntries("a"), testFactory());

    const frame = container.querySelector("[data-frame-key='a']")!;
    const titlebar = frame.querySelector("[data-frame-titlebar]");
    const content = frame.querySelector("[data-test-key='a']");
    expect(titlebar).not.toBeNull();
    expect(titlebar!.textContent).toContain("A");
    expect(content).not.toBeNull();
  });

  it("unmount detaches content, preserves on entries", () => {
    const org = createFreeLayoutStrategy({
      entries: {
        a: {
          position: { x: 0, y: 0 },
          size: { width: 200, height: 150 },
        },
      },
      zOrder: ["a"],
    });
    const entries = makeEntries("a");
    org.mount(container, entries, testFactory());

    const content = container.querySelector("[data-test-key='a']")!;
    org.unmount();

    expect(container.children).toHaveLength(0);
    expect(entries[0]!.contentElement).toBe(content);
  });

  it("returns correct state", () => {
    const org = createFreeLayoutStrategy({
      entries: {
        a: {
          position: { x: 10, y: 20 },
          size: { width: 100, height: 80 },
        },
      },
      zOrder: ["a"],
    });
    org.mount(container, makeEntries("a"), testFactory());

    const state = org.getState() as FreeLayoutState;
    expect(state.entries["a"]!.position).toEqual({ x: 10, y: 20 });
    expect(state.entries["a"]!.size).toEqual({ width: 100, height: 80 });
    expect(state.zOrder).toEqual(["a"]);
  });

  it("fires onEntryMove callback on drag", () => {
    const onEntryMove = vi.fn();
    const org = createFreeLayoutStrategy(
      {
        entries: {
          a: {
            position: { x: 0, y: 0 },
            size: { width: 200, height: 150 },
          },
        },
        zOrder: ["a"],
      },
      { onEntryMove },
    );
    org.mount(container, makeEntries("a"), testFactory());

    const titlebar = container.querySelector(
      "[data-frame-titlebar]",
    ) as HTMLElement;

    titlebar.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 10,
        clientY: 10,
        bubbles: true,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 60, clientY: 80 }),
    );
    document.dispatchEvent(new PointerEvent("pointerup"));

    expect(onEntryMove).toHaveBeenCalledWith("a", 50, 70);
  });

  it("fires onEntryResize callback on resize handle drag", () => {
    const onEntryResize = vi.fn();
    const org = createFreeLayoutStrategy(
      {
        entries: {
          a: {
            position: { x: 0, y: 0 },
            size: { width: 200, height: 150 },
          },
        },
        zOrder: ["a"],
      },
      { onEntryResize },
    );
    org.mount(container, makeEntries("a"), testFactory());

    const handle = container.querySelector(
      "[data-resize-handle='se']",
    ) as HTMLElement;

    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 200,
        clientY: 150,
        bubbles: true,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 250, clientY: 200 }),
    );
    document.dispatchEvent(new PointerEvent("pointerup"));

    expect(onEntryResize).toHaveBeenCalledWith("a", 250, 200);
  });

  it("addEntry creates new frame", () => {
    const org = createFreeLayoutStrategy({
      entries: {
        a: {
          position: { x: 0, y: 0 },
          size: { width: 200, height: 150 },
        },
      },
      zOrder: ["a"],
    });
    org.mount(container, makeEntries("a"), testFactory());

    org.addEntry({ key: "b", label: "B" });

    const frames = container.querySelectorAll("[data-frame-key]");
    expect(frames).toHaveLength(2);
  });

  it("removeEntry removes frame", () => {
    const org = createFreeLayoutStrategy({
      entries: {
        a: {
          position: { x: 0, y: 0 },
          size: { width: 200, height: 150 },
        },
        b: {
          position: { x: 300, y: 0 },
          size: { width: 200, height: 150 },
        },
      },
      zOrder: ["a", "b"],
    });
    org.mount(container, makeEntries("a", "b"), testFactory());

    org.removeEntry("a");

    const frames = container.querySelectorAll("[data-frame-key]");
    expect(frames).toHaveLength(1);
    expect(frames[0]!.getAttribute("data-frame-key")).toBe("b");
  });

  it("clicking a frame brings it to front", () => {
    const org = createFreeLayoutStrategy({
      entries: {
        a: {
          position: { x: 0, y: 0 },
          size: { width: 200, height: 150 },
        },
        b: {
          position: { x: 50, y: 50 },
          size: { width: 200, height: 150 },
        },
      },
      zOrder: ["a", "b"],
    });
    org.mount(container, makeEntries("a", "b"), testFactory());

    const frameA = container.querySelector(
      "[data-frame-key='a']",
    ) as HTMLElement;
    frameA.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    frameA.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true }),
    );

    const state = org.getState() as FreeLayoutState;
    expect(state.zOrder[state.zOrder.length - 1]).toBe("a");
  });

  it("z-order is reflected in CSS zIndex", () => {
    const org = createFreeLayoutStrategy({
      entries: {
        a: {
          position: { x: 0, y: 0 },
          size: { width: 200, height: 150 },
        },
        b: {
          position: { x: 50, y: 50 },
          size: { width: 200, height: 150 },
        },
      },
      zOrder: ["a", "b"],
    });
    org.mount(container, makeEntries("a", "b"), testFactory());

    const frameA = container.querySelector(
      "[data-frame-key='a']",
    ) as HTMLElement;
    frameA.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    frameA.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true }),
    );

    const frameB = container.querySelector(
      "[data-frame-key='b']",
    ) as HTMLElement;
    expect(Number(frameA.style.zIndex)).toBeGreaterThan(
      Number(frameB.style.zIndex),
    );
  });
});
