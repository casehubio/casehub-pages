import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { wireFloatingWorkspace } from "./wire-floating-workspace.js";
import type { ContainerState, FrameLayout, FrameTabConfig } from "@casehubio/pages-component";

function makeTab(key: string): FrameTabConfig {
  return { key, label: key, content: { type: "html", props: { content: `<div>${key}</div>` } } };
}

function makeContainerState(): ContainerState {
  return {
    layout: "free",
    tabs: [
      {
        key: "f1", label: "Frame 1", content: null,
        children: { layout: "tabbed", tabs: [makeTab("t1"), makeTab("t2")] },
      },
      {
        key: "f2", label: "Frame 2", content: null,
        children: { layout: "tabbed", tabs: [makeTab("t3")] },
      },
    ],
    layoutState: {
      entries: {
        f1: { position: { x: 10, y: 20 }, size: { width: 400, height: 300 } },
        f2: { position: { x: 450, y: 20 }, size: { width: 300, height: 250 } },
      },
      zOrder: ["f1", "f2"],
    },
  };
}

describe("wireFloatingWorkspace", () => {
  let hostElement: HTMLElement;

  beforeEach(() => {
    hostElement = document.createElement("div");
  });

  it("creates a root Container and mounts it", () => {
    const handle = wireFloatingWorkspace(hostElement);
    expect(handle.rootContainer).toBeDefined();
    expect(handle.rootContainer.entries).toHaveLength(0);
    expect(handle.rootContainer.organiser.type).toBe("free");
    handle.dispose();
  });

  it("restores from ContainerState", () => {
    const state = makeContainerState();
    const handle = wireFloatingWorkspace(hostElement, state);
    expect(handle.rootContainer.entries).toHaveLength(2);
    expect(handle.rootContainer.entries[0]!.key).toBe("f1");
    expect(handle.rootContainer.entries[1]!.key).toBe("f2");
    handle.dispose();
  });

  it("restores child containers with correct layout", () => {
    const state = makeContainerState();
    const handle = wireFloatingWorkspace(hostElement, state);
    const firstEntry = handle.rootContainer.entries[0]!;
    expect(firstEntry.childContainer).toBeDefined();
    expect(firstEntry.childContainer!.organiser.type).toBe("tabbed");
    expect(firstEntry.childContainer!.entries).toHaveLength(2);
    handle.dispose();
  });

  it("migrates FrameLayout[] to ContainerState", () => {
    const frames: readonly FrameLayout[] = [{
      key: "f1", order: 0, position: { x: 10, y: 20 }, size: { width: 400, height: 300 },
      zIndex: 1, pinned: false, hidden: false, tabs: [makeTab("t1")], activeTabKey: "t1",
    }];
    const handle = wireFloatingWorkspace(hostElement, frames);
    expect(handle.rootContainer.entries).toHaveLength(1);
    expect(handle.rootContainer.entries[0]!.key).toBe("f1");
    handle.dispose();
  });

  it("captureState returns ContainerState", () => {
    const state = makeContainerState();
    const handle = wireFloatingWorkspace(hostElement, state);
    const captured = handle.captureState();
    expect(captured.layout).toBe("free");
    expect(captured.tabs).toHaveLength(2);
    expect(captured.tabs[0]!.key).toBe("f1");
    handle.dispose();
  });

  it("creates container toolbar", () => {
    const handle = wireFloatingWorkspace(hostElement);
    expect(handle.containerToolbar).toBeDefined();
    expect(handle.containerToolbar!.element).toBeDefined();
    handle.dispose();
  });

  it("reuses existing container on mount", () => {
    const state = makeContainerState();
    const handle1 = wireFloatingWorkspace(hostElement, state);
    const rootContainer = handle1.rootContainer;
    handle1.rootContainer.unmount();

    const host2 = document.createElement("div");
    const handle2 = wireFloatingWorkspace(host2, undefined, { existingContainer: rootContainer });
    expect(handle2.rootContainer).toBe(rootContainer);
    handle2.dispose();
  });

  it("dispose cleans up container and toolbar", () => {
    const handle = wireFloatingWorkspace(hostElement, makeContainerState());
    handle.dispose();
    expect(hostElement.children.length).toBe(0);
  });

  describe("mode switch — setLayout round-trip", () => {
    it("setLayout('tabbed') preserves all entries", () => {
      const state = makeContainerState();
      const handle = wireFloatingWorkspace(hostElement, state);
      expect(handle.rootContainer.organiser.type).toBe("free");
      expect(handle.rootContainer.entries).toHaveLength(2);

      handle.rootContainer.setLayout("tabbed");
      expect(handle.rootContainer.organiser.type).toBe("tabbed");
      expect(handle.rootContainer.entries).toHaveLength(2);
      expect(handle.rootContainer.entries[0]!.key).toBe("f1");
      expect(handle.rootContainer.entries[1]!.key).toBe("f2");

      handle.dispose();
    });

    it("setLayout('tabbed') preserves child containers", () => {
      const state = makeContainerState();
      const handle = wireFloatingWorkspace(hostElement, state);

      const childBefore = handle.rootContainer.entries[0]!.childContainer;
      expect(childBefore).toBeDefined();
      expect(childBefore!.entries).toHaveLength(2);

      handle.rootContainer.setLayout("tabbed");

      const childAfter = handle.rootContainer.entries[0]!.childContainer;
      expect(childAfter).toBeDefined();
      expect(childAfter!.entries).toHaveLength(2);
      expect(childAfter!.entries[0]!.key).toBe("t1");

      handle.dispose();
    });

    it("free → tabbed → free round-trip preserves entries and child containers", () => {
      const state = makeContainerState();
      const handle = wireFloatingWorkspace(hostElement, state);

      handle.rootContainer.setLayout("tabbed");
      handle.rootContainer.setLayout("free");

      expect(handle.rootContainer.organiser.type).toBe("free");
      expect(handle.rootContainer.entries).toHaveLength(2);
      expect(handle.rootContainer.entries[0]!.key).toBe("f1");
      expect(handle.rootContainer.entries[0]!.childContainer).toBeDefined();
      expect(handle.rootContainer.entries[0]!.childContainer!.entries).toHaveLength(2);

      handle.dispose();
    });

    it("setLayout('accordion') preserves entries", () => {
      const state = makeContainerState();
      const handle = wireFloatingWorkspace(hostElement, state);

      handle.rootContainer.setLayout("accordion");
      expect(handle.rootContainer.organiser.type).toBe("accordion");
      expect(handle.rootContainer.entries).toHaveLength(2);
      expect(handle.rootContainer.entries[0]!.childContainer).toBeDefined();

      handle.dispose();
    });

    it("captureState after mode switch reflects new layout", () => {
      const state = makeContainerState();
      const handle = wireFloatingWorkspace(hostElement, state);

      handle.rootContainer.setLayout("tabbed");
      const captured = handle.captureState();
      expect(captured.layout).toBe("tabbed");
      expect(captured.tabs).toHaveLength(2);
      expect(captured.tabs[0]!.children).toBeDefined();
      expect(captured.tabs[0]!.children!.layout).toBe("tabbed");

      handle.dispose();
    });
  });

  it("root container has no built-in toolbar — only the external toolbar is used", () => {
    const handle = wireFloatingWorkspace(hostElement);

    const rootOrganiserEl = hostElement.firstElementChild;
    const rootToolbar = rootOrganiserEl?.querySelector(":scope > [data-container-toolbar]");
    expect(rootToolbar).toBeNull();

    expect(handle.containerToolbar).toBeDefined();
    expect(handle.containerToolbar!.element.hasAttribute("data-container-toolbar")).toBe(true);

    handle.dispose();
  });

  it("child containers get their own toolbars", () => {
    const state = makeContainerState();
    const handle = wireFloatingWorkspace(hostElement, state);

    const childToolbars = hostElement.querySelectorAll("[data-container-toolbar]");
    expect(childToolbars.length).toBeGreaterThanOrEqual(2);

    handle.dispose();
  });

  it("leaf entries show a nest button at bottom-right", () => {
    const state = makeContainerState();
    const handle = wireFloatingWorkspace(hostElement, state);

    const nestButtons = hostElement.querySelectorAll("[data-nest-button]");
    expect(nestButtons.length).toBeGreaterThan(0);

    handle.dispose();
  });

  it("nest button containerizes a leaf entry into a child container", () => {
    const state: ContainerState = {
      layout: "free",
      tabs: [{
        key: "f1", label: "Frame 1", content: null,
        children: { layout: "tabbed", tabs: [makeTab("t1")] },
      }],
      layoutState: {
        entries: { f1: { position: { x: 10, y: 20 }, size: { width: 400, height: 300 } } },
        zOrder: ["f1"],
      },
    };
    const handle = wireFloatingWorkspace(hostElement, state);

    const childContainer = handle.rootContainer.entries[0]!.childContainer!;
    const leafEntry = childContainer.entries[0]!;
    expect(leafEntry.childContainer).toBeUndefined();

    const nestBtn = hostElement.querySelector("[data-nest-button]") as HTMLElement;
    expect(nestBtn).not.toBeNull();
    nestBtn.click();

    expect(leafEntry.childContainer).toBeDefined();

    handle.dispose();
  });

  describe("edge split creates split container", () => {
    let host: HTMLElement;

    beforeEach(() => {
      host = document.createElement("div");
      host.style.cssText = "width:800px;height:600px;position:relative;";
      Object.defineProperty(host, "clientWidth", { value: 800, configurable: true });
      Object.defineProperty(host, "clientHeight", { value: 600, configurable: true });
      document.body.appendChild(host);
    });

    afterEach(() => {
      document.body.removeChild(host);
    });

    it("dropping on left edge wraps target in splith container", () => {
      const state: ContainerState = {
        layout: "free",
        tabs: [
          { key: "f1", label: "Frame 1", content: null, children: { layout: "tabbed", tabs: [makeTab("t1"), makeTab("t2")] } },
          { key: "f2", label: "Frame 2", content: null, children: { layout: "tabbed", tabs: [makeTab("t3")] } },
        ],
        layoutState: {
          entries: {
            f1: { position: { x: 0, y: 0 }, size: { width: 350, height: 500 } },
            f2: { position: { x: 400, y: 0 }, size: { width: 350, height: 500 } },
          },
          zOrder: ["f1", "f2"],
        },
      };
      const handle = wireFloatingWorkspace(host, state);

      const freeHost = host.querySelector("[data-free-host]") as HTMLElement;
      vi.spyOn(freeHost, "getBoundingClientRect").mockReturnValue({
        left: 0, right: 800, top: 0, bottom: 600,
        width: 800, height: 600, x: 0, y: 0, toJSON: () => ({}),
      });

      const childF1 = handle.rootContainer.entries[0]!.childContainer!;

      const frameF1 = host.querySelector("[data-frame-key='f1']") as HTMLElement;
      frameF1.dispatchEvent(new CustomEvent("pages-tab-drag-start", {
        bubbles: true,
        detail: { tabKey: "t1", ghost: document.createElement("div"), sourceContainer: childF1 },
      }));

      document.dispatchEvent(new PointerEvent("pointermove", { clientX: 401, clientY: 250 }));
      document.dispatchEvent(new PointerEvent("pointerup", { clientX: 401, clientY: 250 }));

      expect(handle.rootContainer.entries).toHaveLength(2);

      const f2Entry = handle.rootContainer.entries.find(e => e.key === "f2");
      expect(f2Entry).toBeDefined();
      expect(f2Entry!.childContainer).toBeDefined();
      expect(f2Entry!.childContainer!.organiser.type).toBe("splith");

      handle.dispose();
    });
  });

  describe("cross-frame tab drop", () => {
    let host: HTMLElement;

    beforeEach(() => {
      host = document.createElement("div");
      host.style.cssText = "width:800px;height:600px;position:relative;";
      Object.defineProperty(host, "clientWidth", { value: 800, configurable: true });
      Object.defineProperty(host, "clientHeight", { value: 600, configurable: true });
      document.body.appendChild(host);
    });

    afterEach(() => {
      document.body.removeChild(host);
    });

    function makeThreeTabState(): ContainerState {
      return {
        layout: "free",
        tabs: [
          { key: "f1", label: "Frame 1", content: null, children: { layout: "tabbed", tabs: [makeTab("t1"), makeTab("t2"), makeTab("t3")] } },
          { key: "f2", label: "Frame 2", content: null, children: { layout: "tabbed", tabs: [makeTab("t4"), makeTab("t5")] } },
        ],
        layoutState: {
          entries: {
            f1: { position: { x: 0, y: 0 }, size: { width: 350, height: 500 } },
            f2: { position: { x: 400, y: 0 }, size: { width: 350, height: 500 } },
          },
          zOrder: ["f1", "f2"],
        },
      };
    }

    function setupDnD(h: HTMLElement) {
      const freeHost = h.querySelector("[data-free-host]") as HTMLElement;
      vi.spyOn(freeHost, "getBoundingClientRect").mockReturnValue({
        left: 0, right: 800, top: 0, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => ({}),
      });
      const f2Frame = h.querySelector("[data-frame-key='f2']") as HTMLElement;
      const f2Strip = f2Frame?.querySelector("[data-tab-strip]") as HTMLElement;
      if (f2Strip) {
        vi.spyOn(f2Strip, "getBoundingClientRect").mockReturnValue({
          left: 400, right: 750, top: 0, bottom: 30, width: 350, height: 30, x: 400, y: 0, toJSON: () => ({}),
        });
        const f2Tabs = [...f2Strip.querySelectorAll("[data-tab-key]")] as HTMLElement[];
        let tabLeft = 400;
        for (const tab of f2Tabs) {
          const l = tabLeft;
          vi.spyOn(tab, "getBoundingClientRect").mockReturnValue({
            left: l, right: l + 80, top: 0, bottom: 30, width: 80, height: 30, x: l, y: 0, toJSON: () => ({}),
          });
          tabLeft += 80;
        }
      }
      return { freeHost, f2Frame, f2Strip };
    }

    it("cross-frame drop adds tab to target container", () => {
      const handle = wireFloatingWorkspace(host, makeThreeTabState());
      setupDnD(host);

      const childF1 = handle.rootContainer.entries[0]!.childContainer!;
      const childF2 = handle.rootContainer.entries[1]!.childContainer!;
      expect(childF1.entries).toHaveLength(3);
      expect(childF2.entries).toHaveLength(2);

      const frameF1 = host.querySelector("[data-frame-key='f1']") as HTMLElement;
      frameF1.dispatchEvent(new CustomEvent("pages-tab-drag-start", {
        bubbles: true,
        detail: { tabKey: "t2", ghost: document.createElement("div"), sourceContainer: childF1 },
      }));

      document.dispatchEvent(new PointerEvent("pointermove", { clientX: 440, clientY: 15 }));
      document.dispatchEvent(new PointerEvent("pointerup", { clientX: 440, clientY: 15 }));

      expect(childF1.entries).toHaveLength(2);
      expect(childF2.entries).toHaveLength(3);
      expect(childF2.entries.some(e => e.key === "t2")).toBe(true);

      handle.dispose();
    });

    it("cross-frame drop inserts at the preview position, not at end", () => {
      const handle = wireFloatingWorkspace(host, makeThreeTabState());
      setupDnD(host);

      const childF1 = handle.rootContainer.entries[0]!.childContainer!;
      const childF2 = handle.rootContainer.entries[1]!.childContainer!;

      const frameF1 = host.querySelector("[data-frame-key='f1']") as HTMLElement;
      frameF1.dispatchEvent(new CustomEvent("pages-tab-drag-start", {
        bubbles: true,
        detail: { tabKey: "t2", ghost: document.createElement("div"), sourceContainer: childF1 },
      }));

      document.dispatchEvent(new PointerEvent("pointermove", { clientX: 420, clientY: 15 }));
      document.dispatchEvent(new PointerEvent("pointerup", { clientX: 420, clientY: 15 }));

      expect(childF2.entries[0]!.key).toBe("t2");

      handle.dispose();
    });

    it("dropped tab gets activated in target container", () => {
      const handle = wireFloatingWorkspace(host, makeThreeTabState());
      setupDnD(host);

      const childF1 = handle.rootContainer.entries[0]!.childContainer!;
      const childF2 = handle.rootContainer.entries[1]!.childContainer!;

      const frameF1 = host.querySelector("[data-frame-key='f1']") as HTMLElement;
      frameF1.dispatchEvent(new CustomEvent("pages-tab-drag-start", {
        bubbles: true,
        detail: { tabKey: "t2", ghost: document.createElement("div"), sourceContainer: childF1 },
      }));

      document.dispatchEvent(new PointerEvent("pointermove", { clientX: 440, clientY: 15 }));
      document.dispatchEvent(new PointerEvent("pointerup", { clientX: 440, clientY: 15 }));

      const activeTab = childF2.organiser.getState() as { activeKey: string };
      expect(activeTab.activeKey).toBe("t2");

      handle.dispose();
    });
  });
});
