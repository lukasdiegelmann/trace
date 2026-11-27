import { useSearchParams } from "react-router";

import { BACKEND_IDS, isBackendId, type BackendId } from "@/api";

/**
 * Server-wide things (users, tokens, backups...) exist once per backend and
 * can't be merged: the screen works on one at a time, kept in `?app=`.
 */
export function useAppParam(
  allowed: readonly BackendId[] = BACKEND_IDS,
): [BackendId, (backend: BackendId) => void] {
  const [params, setParams] = useSearchParams();
  const wanted = params.get("app") ?? undefined;
  const backend =
    isBackendId(wanted) && allowed.includes(wanted)
      ? wanted
      : (allowed[0] ?? "nt");
  return [
    backend,
    (next) => {
      setParams(
        (previous) => {
          const copy = new URLSearchParams(previous);
          copy.set("app", next);
          return copy;
        },
        { replace: true },
      );
    },
  ];
}
