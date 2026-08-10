import type { FrameLayout } from "@casehubio/pages-component";

export type Preset = "side-by-side" | "stacked" | "grid" | "main-sidebar" | "focus";
type CanvasSize = { width: number; height: number };

const GAP = 8;

export function applyPreset(
  frames: readonly FrameLayout[], canvas: CanvasSize, preset: Preset,
): FrameLayout[] {
  if (frames.length === 0) return [];
  const sorted = [...frames].sort((a, b) => a.order - b.order);

  switch (preset) {
    case "side-by-side": return sideBySide(sorted, canvas);
    case "stacked": return stacked(sorted, canvas);
    case "grid": return grid(sorted, canvas);
    case "main-sidebar": return mainSidebar(sorted, canvas);
    case "focus": return focus(sorted, canvas);
  }
}

function sideBySide(frames: FrameLayout[], c: CanvasSize): FrameLayout[] {
  const w = Math.floor((c.width - GAP * (frames.length - 1)) / frames.length);
  return frames.map((f, i) => ({ ...f, position: { x: i * (w + GAP), y: 0 }, size: { width: w, height: c.height } }));
}

function stacked(frames: FrameLayout[], c: CanvasSize): FrameLayout[] {
  const h = Math.floor((c.height - GAP * (frames.length - 1)) / frames.length);
  return frames.map((f, i) => ({ ...f, position: { x: 0, y: i * (h + GAP) }, size: { width: c.width, height: h } }));
}

function grid(frames: FrameLayout[], c: CanvasSize): FrameLayout[] {
  const cols = Math.ceil(Math.sqrt(frames.length));
  const rows = Math.ceil(frames.length / cols);
  const cellW = Math.floor((c.width - GAP * (cols - 1)) / cols);
  const cellH = Math.floor((c.height - GAP * (rows - 1)) / rows);
  return frames.map((f, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return { ...f, position: { x: col * (cellW + GAP), y: row * (cellH + GAP) }, size: { width: cellW, height: cellH } };
  });
}

function mainSidebar(frames: FrameLayout[], c: CanvasSize): FrameLayout[] {
  if (frames.length === 1) return [{ ...frames[0], position: { x: 0, y: 0 }, size: { width: c.width, height: c.height } }];
  const mainW = Math.floor(c.width * 0.65);
  const sideW = c.width - mainW - GAP;
  const sideH = Math.floor((c.height - GAP * (frames.length - 2)) / (frames.length - 1));
  return [
    { ...frames[0], position: { x: 0, y: 0 }, size: { width: mainW, height: c.height } },
    ...frames.slice(1).map((f, i) => ({ ...f, position: { x: mainW + GAP, y: i * (sideH + GAP) }, size: { width: sideW, height: sideH } })),
  ];
}

function focus(frames: FrameLayout[], c: CanvasSize): FrameLayout[] {
  const mainW = Math.floor(c.width * 0.85);
  const mainH = Math.floor(c.height * 0.85);
  const result: FrameLayout[] = [{
    ...frames[0],
    position: { x: Math.floor((c.width - mainW) / 2), y: Math.floor((c.height - mainH) / 2) },
    size: { width: mainW, height: mainH },
  }];
  const thumbW = 200;
  const thumbH = 150;
  for (let i = 1; i < frames.length; i++) {
    result.push({
      ...frames[i],
      position: { x: c.width - thumbW - GAP, y: GAP + (i - 1) * (thumbH + GAP) },
      size: { width: thumbW, height: thumbH },
    });
  }
  return result;
}
