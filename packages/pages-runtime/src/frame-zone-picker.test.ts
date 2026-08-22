import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createFrameZonePicker } from "./frame-zone-picker.js";
import type { FloatingFrameEngine } from "./floating-frame-engine.js";
import type { FloatingFrameBackend } from "./floating-frame-backend.js";
import type { FrameLayout } from "@casehubio/pages-component";

function makeFrame(key: string, snappedZone?: string): FrameLayout {
  return {
    key, order: 0, position: { x: 100, y: 100 }, size: { width: 400, height: 300 },
    zIndex: 1, pinned: false, hidden: false, tabs: [], activeTabKey: "",
    ...(snappedZone ? { snappedZone } : {}),
  } as FrameLayout;
}

describe("createFrameZonePicker", () => {
  let engine: FloatingFrameEngine;
  let backend: FloatingFrameBackend;
  let container: HTMLElement;
  let controller: AbortController;
  let dblClickCb: (key: string) => void;

  beforeEach(() => {
    engine = {
      frames: new Map([["f1", makeFrame("f1")]]),
      snapFrame: vi.fn(),
      unsnapFrame: vi.fn(),
      recomputeSnappedFrames: vi.fn(),
    } as unknown as FloatingFrameEngine;
    backend = {
      onTitlebarDoubleClick: vi.fn((cb: any) => { dblClickCb = cb; }),
      onViewModeToggle: vi.fn(),
      onAddTab: vi.fn(),
      onTabRemoved: vi.fn(),
      getFrameElement: vi.fn(() => {
        const el = document.createElement("div");
        el.getBoundingClientRect = () => ({ left: 100, top: 100, right: 500, bottom: 400, width: 400, height: 300, x: 100, y: 100, toJSON: () => ({}) });
        return el;
      }),
    } as unknown as FloatingFrameBackend;
    container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 1000, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 800, configurable: true });
    container.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800, x: 0, y: 0, toJSON: () => ({}) });
    controller = new AbortController();
  });

  afterEach(() => { controller.abort(); });

  it("returns a FrameButtonConfig with zone picker icon", () => {
    const btn = createFrameZonePicker(engine, backend, container, controller.signal);
    expect(btn.icon).toBe("⊞");
    expect(btn.title).toBe("Move & Resize");
  });

  it("opens dropdown with 9 zone buttons on click", () => {
    const btn = createFrameZonePicker(engine, backend, container, controller.signal);
    btn.onClick("f1");
    const dropdown = container.querySelector(".frame-zone-dropdown");
    expect(dropdown).not.toBeNull();
    expect(dropdown!.querySelectorAll("button").length).toBe(9);
  });

  it("clicking a zone calls engine.snapFrame", () => {
    const btn = createFrameZonePicker(engine, backend, container, controller.signal);
    btn.onClick("f1");
    const dropdown = container.querySelector(".frame-zone-dropdown")!;
    const leftBtn = dropdown.querySelector("button[title='left']") as HTMLButtonElement;
    leftBtn.click();
    expect(engine.snapFrame).toHaveBeenCalledWith("f1", "left", { width: 1000, height: 800 });
  });

  it("dispatches pages-frame-snap event on zone selection", () => {
    const listener = vi.fn();
    container.addEventListener("pages-frame-snap", listener);
    const btn = createFrameZonePicker(engine, backend, container, controller.signal);
    btn.onClick("f1");
    const dropdown = container.querySelector(".frame-zone-dropdown")!;
    const rightBtn = dropdown.querySelector("button[title='right']") as HTMLButtonElement;
    rightBtn.click();
    expect(listener).toHaveBeenCalled();
    expect((listener.mock.calls[0]![0] as CustomEvent).detail).toEqual({ frameKey: "f1", zone: "right" });
  });

  it("clicking same zone as current unsnaps", () => {
    (engine.frames as Map<string, any>).set("f1", makeFrame("f1", "left"));
    const btn = createFrameZonePicker(engine, backend, container, controller.signal);
    btn.onClick("f1");
    const dropdown = container.querySelector(".frame-zone-dropdown")!;
    const leftBtn = dropdown.querySelector("button[title='left']") as HTMLButtonElement;
    leftBtn.click();
    expect(engine.unsnapFrame).toHaveBeenCalledWith("f1");
  });

  it("closes dropdown after zone selection", () => {
    const btn = createFrameZonePicker(engine, backend, container, controller.signal);
    btn.onClick("f1");
    expect(container.querySelector(".frame-zone-dropdown")).not.toBeNull();
    const dropdown = container.querySelector(".frame-zone-dropdown")!;
    const fullBtn = dropdown.querySelector("button[title='full']") as HTMLButtonElement;
    fullBtn.click();
    expect(container.querySelector(".frame-zone-dropdown")).toBeNull();
  });

  it("toggles dropdown on repeated clicks", () => {
    const btn = createFrameZonePicker(engine, backend, container, controller.signal);
    btn.onClick("f1");
    expect(container.querySelector(".frame-zone-dropdown")).not.toBeNull();
    btn.onClick("f1");
    expect(container.querySelector(".frame-zone-dropdown")).toBeNull();
  });

  it("double-click titlebar snaps to full when not snapped", () => {
    createFrameZonePicker(engine, backend, container, controller.signal);
    dblClickCb("f1");
    expect(engine.snapFrame).toHaveBeenCalledWith("f1", "full", { width: 1000, height: 800 });
  });

  it("double-click titlebar unsnaps when snapped to full", () => {
    createFrameZonePicker(engine, backend, container, controller.signal);
    (engine.frames as Map<string, any>).set("f1", makeFrame("f1", "full"));
    dblClickCb("f1");
    expect(engine.unsnapFrame).toHaveBeenCalledWith("f1");
  });

  it("cleans up on abort", () => {
    const btn = createFrameZonePicker(engine, backend, container, controller.signal);
    btn.onClick("f1");
    controller.abort();
    expect(container.querySelector(".frame-zone-dropdown")).toBeNull();
  });
});
