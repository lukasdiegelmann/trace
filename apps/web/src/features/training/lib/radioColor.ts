/**
 * The cover's colour behind the players: the average of the pixels that are
 * neither near black nor near white (RGBA data of a 32×32 downscale).
 */
export function dominantColor(rgba: ArrayLike<number>): string | null {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let i = 0; i + 2 < rgba.length; i += 4) {
    const r = rgba[i] ?? 0;
    const g = rgba[i + 1] ?? 0;
    const b = rgba[i + 2] ?? 0;
    const brightness = (r + g + b) / 3;
    if (brightness < 20 || brightness > 235) continue;
    red += r;
    green += g;
    blue += b;
    count++;
  }
  if (count === 0) return null;
  const mean = (sum: number) => Math.round(sum / count);
  return `rgb(${mean(red)}, ${mean(green)}, ${mean(blue)})`;
}
