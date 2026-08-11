import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createFrameKeyboardHandler } from "./frame-keyboard.js";
import type { FloatingFrameEngine } from "./floating-frame-engine.js";
import type { FrameLayout } from "@casehubio/pages-component";

function makeMockFrames(...keys: string[]): ReadonlyMap<string, FrameLayout> {
  const map = new Map<string, FrameLayout>();
  keys.forEach((key, i) => {
    map.set(key, {
      key, order: i, position: { x: i * 100, y: 0 }, size: { width: 400, height: 300 },
      zIndex: i + 1, pinned: false, hidden: false, tabs: [], activeTabKey: "",
    });
  });
  return map;
}

function mockEngine(frameKeys: string[] = ["f1", "f2"]): FloatingFrameEngine {
  return {
    frames: makeMockFrames(...frameKeys),
    focusDirection: vi.fn(() => "f2"),
    removeFrame: vi.fn(),
    togglePin: vi.fn(),
    bringToFront: vi.fn(),
    createFrame: vi.fn(),
    hideFrame: vi.fn(), showFrame: vi.fn(),
    addTab: vi.fn(), removeTab: vi.fn(), moveTab: vi.fn(), setActiveTab: vi.fn(),
    updatePosition: vi.fn(), updateSize: vi.fn(),
    setDetached: vi.fn(),
    snapFrame: vi.fn(), unsnapFrame: vi.fn(), recomputeSnappedFrames: vi.fn(),
    applyOrganiser: vi.fn(),
    captureLayout: vi.fn(() => []), restoreLayout: vi.fn(),
    dispose: vi.fn(),
  } as unknown as FloatingFrameEngine;
}

describe("createFrameKeyboardHandler", () => {
  let engine: FloatingFrameEngine;
  let container: HTMLElement;
  let controller: AbortController;

  beforeEach(() => {
    engine = mockEngine();
    container = document.createElement("div");
    controller = new AbortController();
    createFrameKeyboardHandler(engine, container, controller.signal);
  });

  afterEach(() => { controller.abort(); });

  it("Alt+ArrowRight calls focusDirection('right')", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true }));
    expect(engine.focusDirection).toHaveBeenCalledWith("right");
  });

  it("Alt+ArrowLeft calls focusDirection('left')", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true }));
    expect(engine.focusDirection).toHaveBeenCalledWith("left");
  });

  it("Alt+ArrowUp calls focusDirection('up')", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true }));
    expect(engine.focusDirection).toHaveBeenCalledWith("up");
  });

  it("Alt+ArrowDown calls focusDirection('down')", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true }));
    expect(engine.focusDirection).toHaveBeenCalledWith("down");
  });

  it("Alt+W closes focused frame after nav", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "w", altKey: true }));
    expect(engine.removeFrame).toHaveBeenCalledWith("f2");
  });

  it("Alt+W is no-op when no frame is focused", () => {
    (engine.focusDirection as ReturnType<typeof vi.fn>).mockReturnValue(null);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "w", altKey: true }));
    expect(engine.removeFrame).not.toHaveBeenCalled();
  });

  it("Alt+P toggles pin on focused frame", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "p", altKey: true }));
    expect(engine.togglePin).toHaveBeenCalledWith("f2");
  });

  it("Alt+1 focuses first frame by order", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "1", altKey: true }));
    expect(engine.bringToFront).toHaveBeenCalledWith("f1");
  });

  it("Alt+2 focuses second frame by order", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "2", altKey: true }));
    expect(engine.bringToFront).toHaveBeenCalledWith("f2");
  });

  it("Alt+] cycles forward", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "1", altKey: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "]", altKey: true }));
    expect(engine.bringToFront).toHaveBeenCalledWith("f2");
  });

  it("Alt+[ cycles backward with wrap", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "1", altKey: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "[", altKey: true }));
    expect(engine.bringToFront).toHaveBeenCalledWith("f2");
  });

  it("cleans up on abort", () => {
    controller.abort();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true }));
    expect(engine.focusDirection).not.toHaveBeenCalled();
  });

  it("ignores non-alt shortcuts", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(engine.focusDirection).not.toHaveBeenCalled();
  });

  it("ignores shortcuts when in text input", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true }));
    expect(engine.focusDirection).not.toHaveBeenCalled();
    input.remove();
  });
});
