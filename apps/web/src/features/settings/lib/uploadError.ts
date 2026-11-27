import { ApiError } from "@/api";

export type UploadProblem = "tooLarge" | "gateway" | "offline" | null;

/** The failures an upload can name better than the server (cooktrace api.js) */
export function uploadProblem(caught: unknown): UploadProblem {
  if (caught instanceof ApiError) {
    if (caught.status === 413) return "tooLarge";
    if (caught.status === 502 || caught.status === 504) return "gateway";
    return null;
  }
  // fetch rejects with a TypeError when the connection drops.
  return caught instanceof TypeError ? "offline" : null;
}
