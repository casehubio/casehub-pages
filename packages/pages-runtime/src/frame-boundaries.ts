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
    x: existing[existing.length - 1].x + displacement,
    y: existing[existing.length - 1].y + displacement,
  };

  for (let attempt = 0; attempt < 20; attempt++) {
    const collides = existing.some(e => Math.abs(e.x - candidate.x) < 10 && Math.abs(e.y - candidate.y) < 10);
    if (!collides) break;
    candidate = { x: candidate.x + displacement, y: candidate.y + displacement };
  }

  return clampPosition(candidate, frameSize, container);
}
