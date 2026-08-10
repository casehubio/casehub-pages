import type { FrameLayout, FrameTabConfig, ContentFactory } from "@casehubio/pages-component";

export interface FloatingFrameBackend {
  attach(container: HTMLElement, contentFactory: ContentFactory): void;
  detach(): void;

  renderFrame(layout: FrameLayout): void;
  removeFrame(key: string): void;
  updatePosition(key: string, pos: { x: number; y: number }): void;
  updateSize(key: string, size: { width: number; height: number }): void;
  bringToFront(key: string): void;

  addTab(frameKey: string, tab: FrameTabConfig): void;
  removeTab(frameKey: string, tabKey: string): void;
  setActiveTab(frameKey: string, tabKey: string): void;

  onFrameMove(cb: (key: string, pos: { x: number; y: number }) => void): void;
  onFrameResize(cb: (key: string, size: { width: number; height: number }) => void): void;
  onTabDragOut(cb: (fromFrame: string, tabKey: string, position: { x: number; y: number }) => void): void;
  onTabReorder(cb: (frameKey: string, tabKeys: string[]) => void): void;

  dispose(): void;
  unwrap(): unknown | null;
}
