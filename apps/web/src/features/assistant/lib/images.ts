/** A photo as a data URL, scaled down so a request stays small */
const MAX_EDGE = 1600;
const QUALITY = 0.85;

function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(new Error("Could not read the photo"));
    };
    reader.readAsDataURL(file);
  });
}

export function scaledSize(
  width: number,
  height: number,
  maxEdge = MAX_EDGE,
): { width: number; height: number } {
  const factor = Math.min(1, maxEdge / Math.max(width, height, 1));
  return {
    width: Math.round(width * factor),
    height: Math.round(height * factor),
  };
}

export async function imageDataUrl(file: Blob): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", QUALITY);
  } catch {
    // A format the browser can't draw goes as it is.
    return readDataUrl(file);
  }
}
