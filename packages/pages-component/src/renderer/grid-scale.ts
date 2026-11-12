export function scaleWidth(sourceWidth: number, sourceColumns: number, targetColumns: number): number {
  const scaled = Math.round(sourceWidth * targetColumns / sourceColumns);
  return Math.min(Math.max(1, scaled), targetColumns);
}
