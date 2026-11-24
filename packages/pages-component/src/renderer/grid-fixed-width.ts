export function computeEffectiveWidth(
  fixedWidth: number,
  cellWidth: number,
  gap: number,
  declaredW: number,
): number {
  if (fixedWidth <= 0 || cellWidth <= 0) return 1;
  const needed = Math.ceil((fixedWidth + gap) / (cellWidth + gap));
  return Math.max(1, Math.min(needed, declaredW));
}
