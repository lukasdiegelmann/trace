/* eslint-disable @typescript-eslint/naming-convention -- the backend's JSON keys */
/**
 * LiftTrace calls of set videos (old `LtApi.uploadSetVideo`,
 * `attachSetVideo`, `getSetMedia*`, `deleteSetVideo`), with the backend's
 * JSON shapes (server/routes/set-media.js, lib/set-media.js `_shape`).
 * Paths are relative to `/lt/api`.
 */
import { api } from "@/api";

const lt = api.lt;

/** The coach's note on a clip, joined in by the list routes */
export interface SetMediaNote {
  id: number;
  author?: string | null;
  body: string;
  time_sec?: number | null;
  member_reply?: string | null;
  seen_by_member_at?: string | null;
}

/** A row of `/set-media`; POST answers it without `mime`, `created_at`, `note` */
export interface SetMedia {
  id: number;
  workout_id?: number;
  date?: string;
  exercise_uuid?: string | null;
  set_uuid?: string | null;
  duration_sec?: number | null;
  size_bytes?: number | null;
  mime?: string | null;
  created_at?: string | null;
  /** `/api/set-media/:id/file`, relative to the backend: see `common/assets` */
  file_url: string;
  note?: SetMediaNote | null;
}

export interface SetVideoUpload {
  url: string;
  mimeType: string;
  sizeBytes?: number;
}

export interface AttachSetVideoBody {
  workout_id: number;
  exercise_uuid: string | undefined;
  set_uuid: string | null;
  url: string;
  mime?: string | null;
  size_bytes?: number | null;
  duration_sec?: number | null;
}

export const setMediaApi = {
  /** Step one of attaching: the bytes (multipart `file`, up to 200 MB) */
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return lt.post<SetVideoUpload>("/upload/set-video", form);
  },
  /** Step two: the row pointing at the uploaded file */
  attach: (body: AttachSetVideoBody) => lt.post<SetMedia>("/set-media", body),
  /** A day's clips with their coach notes, so the diary can mark sets */
  listForDate: (date: string) =>
    lt.get<{ media: SetMedia[] }>("/set-media", { query: { date } }),
  /** One session's clips with their coach notes */
  listForWorkout: (workoutId: number) =>
    lt.get<{ media: SetMedia[] }>("/set-media", {
      query: { workout_id: workoutId },
    }),
  remove: (id: number) => lt.delete<{ ok: boolean }>(`/set-media/${id}`),
};
