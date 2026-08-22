import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createGroupOrganiserBackend } from "./group-organiser-backend.js";
import type { FloatingFrameBackend } from "./floating-frame-backend.js";
import type {
  FrameLayout,
  FrameTabConfig,
  ContentFactory,
} from "@casehubio/pages-component";

function testContentFactory(): ContentFactory {
  return (tab: FrameTabConfig) => {
    const el = document.createElement("div");
    el.textContent = `Tab: ${tab.key}`;
    el.dataset.contentKey = tab.key;
    return { element: el };
  };
}

function makeLayout(
  key: string,
  tabs: string[],
  overrides?: Partial<FrameLayout>,
): FrameLayout {
  return {
    key,
    tabs: tabs.map((t) => ({
      key: t,
      label: t.toUpperCase(),
      content: { type: "html", props: {} },
    })),
    position: { x: 50, y: 50 },
    size: { width: 300, height: 200 },
    order: 0,
    zIndex: 1,
    pinned: false,
    hidden: false,
    activeTabKey: tabs[0]!,
    ...overrides,
  };
}

describe("GroupOrganiserBackend", () => {
  let container: HTMLElement;
  let backend: FloatingFrameBackend;

  beforeEach(() => {
    container = document.createElement("div");
    container.style.cssText = "width:800px;height:600px;";
    document.body.appendChild(container);
    backend = createGroupOrganiserBackend();
    backend.attach(container, testContentFactory());
  });

  afterEach(() => {
    backend.dispose();
    document.body.removeChild(container);
  });

  it("renderFrame creates a positioned frame with tabs", () => {
    backend.renderFrame(makeLayout("f1", ["a", "b"]));

    const frame = container.querySelector("[data-frame-key='f1']");
    expect(frame).not.toBeNull();
    const tabs = container.querySelectorAll(
      "[data-tab-strip] [data-tab-key]",
    );
    expect(tabs).toHaveLength(2);
  });

  it("renderFrame sets position and size from layout", () => {
    backend.renderFrame(
      makeLayout("f1", ["a"], {
        position: { x: 100, y: 200 },
        size: { width: 500, height: 400 },
      }),
    );

    const frame = container.querySelector(
      "[data-frame-key='f1']",
    ) as HTMLElement;
    expect(frame.style.left).toBe("100px");
    expect(frame.style.top).toBe("200px");
    expect(frame.style.width).toBe("500px");
    expect(frame.style.height).toBe("400px");
  });

  it("removeFrame removes the frame", () => {
    backend.renderFrame(makeLayout("f1", ["a"]));
    backend.removeFrame("f1");

    expect(container.querySelector("[data-frame-key='f1']")).toBeNull();
  });

  it("addTab adds a tab to a frame", () => {
    backend.renderFrame(makeLayout("f1", ["a"]));
    backend.addTab("f1", {
      key: "b",
      label: "B",
      content: { type: "html", props: {} },
    });

    const tabs = container.querySelectorAll(
      "[data-tab-strip] [data-tab-key]",
    );
    expect(tabs).toHaveLength(2);
  });

  it("removeTab removes a tab", () => {
    backend.renderFrame(makeLayout("f1", ["a", "b"]));
    backend.removeTab("f1", "a");

    const tabs = container.querySelectorAll(
      "[data-tab-strip] [data-tab-key]",
    );
    expect(tabs).toHaveLength(1);
  });

  it("setActiveTab switches visible content", () => {
    backend.renderFrame(makeLayout("f1", ["a", "b"]));
    backend.setActiveTab("f1", "b");

    const content = container.querySelector(
      "[data-tab-content] [data-content-key='b']",
    );
    expect(content).not.toBeNull();
  });

  it("updatePosition changes frame CSS", () => {
    backend.renderFrame(makeLayout("f1", ["a"]));
    backend.updatePosition("f1", { x: 100, y: 200 });

    const frame = container.querySelector(
      "[data-frame-key='f1']",
    ) as HTMLElement;
    expect(frame.style.left).toBe("100px");
    expect(frame.style.top).toBe("200px");
  });

  it("updateSize changes frame CSS", () => {
    backend.renderFrame(makeLayout("f1", ["a"]));
    backend.updateSize("f1", { width: 500, height: 400 });

    const frame = container.querySelector(
      "[data-frame-key='f1']",
    ) as HTMLElement;
    expect(frame.style.width).toBe("500px");
    expect(frame.style.height).toBe("400px");
  });

  it("bringToFront updates z-order", () => {
    backend.renderFrame(makeLayout("f1", ["a"], { zIndex: 1 }));
    backend.renderFrame(makeLayout("f2", ["b"], { zIndex: 2 }));

    backend.bringToFront("f1");

    const f1 = container.querySelector(
      "[data-frame-key='f1']",
    ) as HTMLElement;
    const f2 = container.querySelector(
      "[data-frame-key='f2']",
    ) as HTMLElement;
    expect(Number(f1.style.zIndex)).toBeGreaterThan(
      Number(f2.style.zIndex),
    );
  });

  it("getFrameElement returns the frame div", () => {
    backend.renderFrame(makeLayout("f1", ["a"]));
    const el = backend.getFrameElement("f1");
    expect(el).not.toBeNull();
    expect(el!.getAttribute("data-frame-key")).toBe("f1");
  });

  it("getFrameElement returns null for unknown key", () => {
    expect(backend.getFrameElement("nope")).toBeNull();
  });

  it("onFrameMove fires when frame is dragged", () => {
    const cb = vi.fn();
    backend.onFrameMove(cb);
    backend.renderFrame(makeLayout("f1", ["a"]));

    const titlebar = container.querySelector(
      "[data-frame-titlebar]",
    ) as HTMLElement;
    titlebar.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 60,
        clientY: 60,
        bubbles: true,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 110, clientY: 130 }),
    );
    document.dispatchEvent(new PointerEvent("pointerup"));

    expect(cb).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    );
  });

  it("onFrameResize fires when frame is resized", () => {
    const cb = vi.fn();
    backend.onFrameResize(cb);
    backend.renderFrame(makeLayout("f1", ["a"]));

    const handle = container.querySelector(
      "[data-resize-handle='se']",
    ) as HTMLElement;
    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 350,
        clientY: 250,
        bubbles: true,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 400, clientY: 300 }),
    );
    document.dispatchEvent(new PointerEvent("pointerup"));

    expect(cb).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number),
      }),
    );
  });

  it("onFrameClose fires from chrome close button", () => {
    const cb = vi.fn();
    backend.onFrameClose(cb);
    backend.renderFrame(makeLayout("f1", ["a"]));

    const closeBtn = container.querySelector(".frame-close-dot") as HTMLElement;
    closeBtn.click();

    expect(cb).toHaveBeenCalledWith("f1");
  });

  it("onFramePin fires from chrome pin button", () => {
    const cb = vi.fn();
    backend.onFramePin(cb);
    backend.renderFrame(makeLayout("f1", ["a"]));

    const pinBtn = container.querySelector(".frame-pin-btn") as HTMLElement;
    pinBtn.click();

    expect(cb).toHaveBeenCalledWith("f1");
  });

  it("onTabDragOut fires when tab dragged outside strip", () => {
    const cb = vi.fn();
    backend.onTabDragOut(cb);
    backend.renderFrame(makeLayout("f1", ["a", "b"]));

    const tabA = container.querySelector(
      "[data-tab-key='a']",
    ) as HTMLElement;
    tabA.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 10,
        clientY: 10,
        bubbles: true,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 10, clientY: 200 }),
    );
    document.dispatchEvent(new PointerEvent("pointerup"));

    expect(cb).toHaveBeenCalledWith("f1", "a", { x: 10, y: 200 });
  });

  it("onTabReorder fires when tabs reordered via drag", () => {
    const cb = vi.fn();
    backend.onTabReorder(cb);
    backend.renderFrame(makeLayout("f1", ["a", "b", "c"]));

    // Mock tab bounds for reorder detection
    const buttons = [
      ...container.querySelectorAll("[data-tab-key]"),
    ] as HTMLElement[];
    let left = 0;
    for (const btn of buttons) {
      const l = left;
      vi.spyOn(btn, "getBoundingClientRect").mockReturnValue({
        left: l, right: l + 80, top: 0, bottom: 30,
        width: 80, height: 30, x: l, y: 0, toJSON: () => ({}),
      } as DOMRect);
      left += 80;
    }
    const strip = container.querySelector("[data-tab-strip]") as HTMLElement;
    vi.spyOn(strip, "getBoundingClientRect").mockReturnValue({
      left: 0, right: left, top: 0, bottom: 30,
      width: left, height: 30, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);

    const tabA = buttons[0]!;
    tabA.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 40,
        clientY: 15,
        bubbles: true,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 200, clientY: 15 }),
    );
    document.dispatchEvent(new PointerEvent("pointerup"));

    expect(cb).toHaveBeenCalledWith("f1", expect.any(Array));
  });

  it("updatePinState toggles drag lock", () => {
    backend.renderFrame(makeLayout("f1", ["a"]));
    backend.updatePinState("f1", true);

    const pinBtn = container.querySelector(".frame-pin-btn") as HTMLElement;
    expect(pinBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("dispose cleans up all frames", () => {
    backend.renderFrame(makeLayout("f1", ["a"]));
    backend.renderFrame(makeLayout("f2", ["b"]));
    backend.dispose();

    expect(container.querySelector("[data-frame-key]")).toBeNull();
  });

  it("unwrap returns null", () => {
    expect(backend.unwrap()).toBeNull();
  });
});
