import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createFrameDetachHandler } from "./frame-detach-handler.js";
import type { FloatingFrameEngine } from "./floating-frame-engine.js";
import type { ContentFactory, FrameLayout } from "@casehubio/pages-component";

function makeFrame(key: string): FrameLayout {
  return {
    key, order: 0, position: { x: 0, y: 0 }, size: { width: 400, height: 300 },
    zIndex: 1, pinned: false, hidden: false,
    tabs: [{ key: "t1", label: "Tab 1", content: { type: "html", props: { content: "<div>test</div>" } } }],
    activeTabKey: "t1",
  };
}

function mockEngine(frameKeys: string[] = ["f1"]): FloatingFrameEngine {
  const framesMap = new Map<string, FrameLayout>();
  for (const key of frameKeys) framesMap.set(key, makeFrame(key));

  return {
    frames: framesMap,
    hideFrame: vi.fn(),
    showFrame: vi.fn(),
    setDetached: vi.fn(),
    createFrame: vi.fn(), removeFrame: vi.fn(),
    addTab: vi.fn(), removeTab: vi.fn(), moveTab: vi.fn(), setActiveTab: vi.fn(),
    bringToFront: vi.fn(), togglePin: vi.fn(),
    updatePosition: vi.fn(), updateSize: vi.fn(),
    focusDirection: vi.fn(), applyOrganiser: vi.fn(),
    snapFrame: vi.fn(), unsnapFrame: vi.fn(), recomputeSnappedFrames: vi.fn(),
    captureLayout: vi.fn(() => []), restoreLayout: vi.fn(),
    dispose: vi.fn(),
  } as unknown as FloatingFrameEngine;
}

describe("createFrameDetachHandler", () => {
  let engine: FloatingFrameEngine;
  let container: HTMLElement;
  let factory: ContentFactory;
  let controller: AbortController;
  let mockWin: any;

  beforeEach(() => {
    engine = mockEngine();
    container = document.createElement("div");
    factory = vi.fn(() => ({ element: document.createElement("div") }));
    controller = new AbortController();
    const mockBody = document.createElement("div");
    Object.defineProperty(mockBody, "style", {
      value: { margin: "", width: "", height: "", overflow: "" },
      writable: true,
    });
    const mockHead = document.createElement("head");
    const eventTarget = new EventTarget();
    const mockDoc = {
      title: "",
      body: mockBody,
      head: mockHead,
      createElement: (tag: string) => document.createElement(tag),
      adoptNode: (el: Node) => el,
      querySelectorAll: document.querySelectorAll.bind(document),
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
    };
    mockWin = {
      document: mockDoc,
      addEventListener: vi.fn(),
      focus: vi.fn(),
      close: vi.fn(),
      closed: false,
    };
    vi.spyOn(globalThis, "open" as any).mockReturnValue(mockWin);
  });

  afterEach(() => {
    controller.abort();
    vi.restoreAllMocks();
  });

  it("hides frame and opens child window on detach", () => {
    const handler = createFrameDetachHandler(engine, container, factory, controller.signal);
    handler.detach("f1");
    expect(engine.hideFrame).toHaveBeenCalledWith("f1");
    expect(engine.setDetached).toHaveBeenCalledWith("f1", true);
    expect(globalThis.open).toHaveBeenCalled();
  });

  it("renders content via factory in child window", () => {
    const handler = createFrameDetachHandler(engine, container, factory, controller.signal);
    handler.detach("f1");
    expect(factory).toHaveBeenCalled();
  });

  it("dispatches pages-frame-detach event", () => {
    const listener = vi.fn();
    container.addEventListener("pages-frame-detach", listener);
    const handler = createFrameDetachHandler(engine, container, factory, controller.signal);
    handler.detach("f1");
    expect(listener).toHaveBeenCalled();
    expect((listener.mock.calls[0]![0] as CustomEvent).detail.frameKey).toBe("f1");
  });

  it("shows frame and clears detached on reattach", () => {
    const handler = createFrameDetachHandler(engine, container, factory, controller.signal);
    handler.detach("f1");
    handler.reattach("f1");
    expect(engine.showFrame).toHaveBeenCalledWith("f1");
    expect(engine.setDetached).toHaveBeenCalledWith("f1", false);
  });

  it("closes child window on reattach", () => {
    const handler = createFrameDetachHandler(engine, container, factory, controller.signal);
    handler.detach("f1");
    handler.reattach("f1");
    expect(mockWin.close).toHaveBeenCalled();
  });

  it("dispatches pages-frame-reattach event", () => {
    const listener = vi.fn();
    container.addEventListener("pages-frame-reattach", listener);
    const handler = createFrameDetachHandler(engine, container, factory, controller.signal);
    handler.detach("f1");
    handler.reattach("f1");
    expect(listener).toHaveBeenCalled();
  });

  it("is no-op for unknown frame key", () => {
    const handler = createFrameDetachHandler(engine, container, factory, controller.signal);
    handler.detach("unknown");
    expect(engine.hideFrame).not.toHaveBeenCalled();
  });

  it("reattach is no-op if not detached", () => {
    const handler = createFrameDetachHandler(engine, container, factory, controller.signal);
    handler.reattach("f1");
    expect(engine.showFrame).not.toHaveBeenCalled();
  });

  it("handles popup blocked gracefully", () => {
    (globalThis.open as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const handler = createFrameDetachHandler(engine, container, factory, controller.signal);
    handler.detach("f1");
    expect(engine.hideFrame).toHaveBeenCalled();
    expect(engine.showFrame).toHaveBeenCalledWith("f1");
    expect(engine.setDetached).toHaveBeenLastCalledWith("f1", false);
  });

  it("dispose reattaches all detached frames", () => {
    const handler = createFrameDetachHandler(engine, container, factory, controller.signal);
    handler.detach("f1");
    handler.dispose();
    expect(engine.showFrame).toHaveBeenCalledWith("f1");
  });
});
