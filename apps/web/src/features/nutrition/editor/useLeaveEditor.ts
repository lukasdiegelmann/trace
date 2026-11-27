import { useCallback } from "react";
import { useNavigate } from "react-router";

/** Back to where the editor was opened from, else to `fallback` */
export function useLeaveEditor(fallback = "/nutrition/foods"): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const state = window.history.state as { idx?: number } | null;
    if ((state?.idx ?? 0) > 0) void navigate(-1);
    else void navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
