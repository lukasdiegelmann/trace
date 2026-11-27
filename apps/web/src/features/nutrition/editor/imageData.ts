/** Photos as data URLs: reading, shrinking and cropping (lib/image-fit.js) */
import type { SquareCrop } from "../lib/cropGeometry";

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("read failed"));
    };
    reader.readAsDataURL(file);
  });
}

export function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error("not an image"));
    };
    image.src = source;
  });
}

function draw(
  image: HTMLImageElement,
  from: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
  quality: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    from.x,
    from.y,
    from.width,
    from.height,
    0,
    0,
    width,
    height,
  );
  return canvas.toDataURL("image/jpeg", quality);
}

/** At most 1920px on the longest edge, so a phone photo fits the body limit */
export async function fitImageDataUrl(
  dataUrl: string,
  maxEdge = 1920,
  quality = 0.92,
): Promise<string> {
  const image = await loadImage(dataUrl);
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!width || !height || (width <= maxEdge && height <= maxEdge)) {
    return dataUrl;
  }
  const scale = Math.min(maxEdge / width, maxEdge / height);
  return draw(
    image,
    { x: 0, y: 0, width, height },
    Math.round(width * scale),
    Math.round(height * scale),
    quality,
  );
}

export async function cropImageDataUrl(
  dataUrl: string,
  crop: SquareCrop,
  size = 512,
): Promise<string> {
  const image = await loadImage(dataUrl);
  return draw(
    image,
    { x: crop.x, y: crop.y, width: crop.size, height: crop.size },
    size,
    size,
    0.9,
  );
}
