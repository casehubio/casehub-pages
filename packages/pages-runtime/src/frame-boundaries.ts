import type { SnapZone } from "@casehubio/pages-component";

type Position = { x: number; y: number };
type Size = { width: number; height: number };

const DEFAULT_DISPLACEMENT = 30;

export function clampPosition(pos: Position, size: Size, container: Size): Position {
  return {
    x: Math.max(0, Math.min(pos.x, container.width - size.width)),
    y: Math.max(0, Math.min(pos.y, container.height - size.height)),
  };
}

export function nextFramePosition(
  container: Size, frameSize: Size, existing: readonly Position[], displacement = DEFAULT_DISPLACEMENT,
): Position {
  if (existing.length === 0) {
    return {
      x: Math.floor((container.width - frameSize.width) / 2),
      y: Math.floor((container.height - frameSize.height) / 2),
    };
  }

  let candidate = {
    x: existing[existing.length - 1]!.x + displacement,
    y: existing[existing.length - 1]!.y + displacement,
  };

  for (let attempt = 0; attempt < 20; attempt++) {
    const collides = existing.some(e => Math.abs(e.x - candidate.x) < 10 && Math.abs(e.y - candidate.y) < 10);
    if (!collides) break;
    candidate = { x: candidate.x + displacement, y: candidate.y + displacement };
  }

  return clampPosition(candidate, frameSize, container);
}

const DEFAULT_THRESHOLD = 40;

export function snapToZone(
  dragPosition: Position,
  containerSize: Size,
  threshold = DEFAULT_THRESHOLD,
): SnapZone | null {
  const nearLeft = dragPosition.x <= threshold;
  const nearRight = dragPosition.x >= containerSize.width - threshold;
  const nearTop = dragPosition.y <= threshold;
  const nearBottom = dragPosition.y >= containerSize.height - threshold;

  if (nearLeft && nearTop) return "top-left";
  if (nearRight && nearTop) return "top-right";
  if (nearLeft && nearBottom) return "bottom-left";
  if (nearRight && nearBottom) return "bottom-right";
  if (nearLeft) return "left";
  if (nearRight) return "right";
  if (nearTop) return "top";
  if (nearBottom) return "bottom";
  return null;
}

const DEFAULT_GAP = 8;

export function zoneToRect(
  zone: SnapZone,
  containerSize: Size,
  gap = DEFAULT_GAP,
): { position: Position; size: Size } {
  const halfW = Math.floor((containerSize.width - gap) / 2);
  const halfH = Math.floor((containerSize.height - gap) / 2);
  const rightX = containerSize.width - halfW;
  const bottomY = containerSize.height - halfH;

  switch (zone) {
    case "left": return { position: { x: 0, y: 0 }, size: { width: halfW, height: containerSize.height } };
    case "right": return { position: { x: rightX, y: 0 }, size: { width: halfW, height: containerSize.height } };
    case "top": return { position: { x: 0, y: 0 }, size: { width: containerSize.width, height: halfH } };
    case "bottom": return { position: { x: 0, y: bottomY }, size: { width: containerSize.width, height: halfH } };
    case "top-left": return { position: { x: 0, y: 0 }, size: { width: halfW, height: halfH } };
    case "top-right": return { position: { x: rightX, y: 0 }, size: { width: halfW, height: halfH } };
    case "bottom-left": return { position: { x: 0, y: bottomY }, size: { width: halfW, height: halfH } };
    case "bottom-right": return { position: { x: rightX, y: bottomY }, size: { width: halfW, height: halfH } };
    case "full": return { position: { x: 0, y: 0 }, size: { width: containerSize.width, height: containerSize.height } };
    default: {
      const _exhaustive: never = zone;
      return _exhaustive;
    }
  }
}
