/** The square photo crop, ported from nutritrace/src/lib/crop-geometry.js */

export interface SquareCrop {
  x: number;
  y: number;
  size: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function centeredSquareCrop(
  width: number,
  height: number,
  coverage = 0.8,
): SquareCrop {
  const safeWidth = Math.max(0, width || 0);
  const safeHeight = Math.max(0, height || 0);
  const size = Math.round(
    Math.min(safeWidth, safeHeight) * clamp(coverage || 0.8, 0.1, 1),
  );
  return {
    x: Math.round((safeWidth - size) / 2),
    y: Math.round((safeHeight - size) / 2),
    size,
  };
}

export function moveSquareCrop(
  crop: SquareCrop,
  deltaX: number,
  deltaY: number,
  width: number,
  height: number,
): SquareCrop {
  return {
    ...crop,
    x: clamp(crop.x + deltaX, 0, Math.max(0, width - crop.size)),
    y: clamp(crop.y + deltaY, 0, Math.max(0, height - crop.size)),
  };
}

export function resizeSquareCrop(
  crop: SquareCrop,
  deltaX: number,
  deltaY: number,
  width: number,
  height: number,
  minSize = 48,
): SquareCrop {
  const delta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
  const maxSize = Math.max(0, Math.min(width - crop.x, height - crop.y));
  const effectiveMin = Math.min(Math.max(1, minSize), maxSize);
  return { ...crop, size: clamp(crop.size + delta, effectiveMin, maxSize) };
}
