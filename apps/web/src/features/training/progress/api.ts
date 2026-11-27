import { api } from "@/api";

import type { ProgressPhoto } from "../lib/progressPhotos";
import { isHeic } from "../lib/progressPhotos";
import type { BodyStatsRow } from "../lib/statistics";

export function getProgressPhotos(
  start: string,
  end: string,
): Promise<ProgressPhoto[]> {
  return api.lt
    .get<{ photos?: ProgressPhoto[] }>("/body-stats/photos", {
      query: { start, end },
    })
    .then((answer) => answer.photos ?? []);
}

export function getBodyStats(
  start: string,
  end: string,
): Promise<BodyStatsRow[]> {
  return api.lt.get<BodyStatsRow[]>("/body-stats/range", {
    query: { start, end },
  });
}

/**
 * iPhones shoot HEIC, which only Safari shows: convert it here (loaded only
 * for such a file). If that fails the original goes up, which the server
 * also accepts.
 */
async function prepare(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  try {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });
    const blob = Array.isArray(converted) ? converted.at(0) : converted;
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.hei[cf]$/i, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

export async function addProgressPhoto(
  file: File,
  date: string,
): Promise<void> {
  const body = new FormData();
  body.append("file", await prepare(file));
  const { url } = await api.lt.post<{ url: string }>(
    "/upload/body-stats",
    body,
  );
  await api.lt.post("/body-stats/photos", { date, url });
}

export function deleteProgressPhoto(id: number): Promise<unknown> {
  return api.lt.delete(`/body-stats/photos/${id}`);
}

/**
 * Saves one day's weight. The server merges measurement by measurement, so
 * the day's other values stay.
 */
export function saveWeight(date: string, weight: number): Promise<unknown> {
  return api.lt.put(`/body-stats/${date}`, { stats: { weight } });
}
