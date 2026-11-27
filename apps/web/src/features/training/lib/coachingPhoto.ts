/**
 * A photo as a data URL for a message, after LiftTrace's lib/image-embed.js
 * (its `redraw` path): always drawn again, so where and when it was taken
 * (EXIF) never goes to the other person.
 */
export const PHOTO_MAX_EMBEDDED = 1_200_000;

const STEPS = [
  { dim: 1600, quality: 0.82 },
  { dim: 1200, quality: 0.78 },
  { dim: 900, quality: 0.72 },
  { dim: 700, quality: 0.65 },
];

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(new Error("unreadable photo"));
    };
    reader.readAsDataURL(file);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error("unreadable photo"));
    };
    image.src = url;
  });
}

/** JPEG would paint see-through pixels black (every 40th pixel is enough) */
function hasTransparency(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  try {
    const { data } = context.getImageData(0, 0, width, height);
    for (let i = 3; i < data.length; i += 160) {
      if ((data[i] ?? 255) < 255) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/** Throws when the browser can't open the photo or it stays too large */
export async function embeddablePhoto(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  const image = await loadImage(original);
  // A GIF can't be redrawn without losing its frames: as it is, or not at all.
  if (/^image\/gif$/i.test(file.type)) {
    if (original.length > PHOTO_MAX_EMBEDDED) {
      throw new Error("photo too large");
    }
    return original;
  }
  const { naturalWidth: width, naturalHeight: height } = image;
  for (const step of STEPS) {
    const scale =
      width && height ? Math.min(1, step.dim / Math.max(width, height)) : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((width || step.dim) * scale));
    canvas.height = Math.max(1, Math.round((height || step.dim) * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("unreadable photo");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const out = hasTransparency(context, canvas.width, canvas.height)
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", step.quality);
    if (out.length <= PHOTO_MAX_EMBEDDED) return out;
  }
  throw new Error("photo too large");
}
