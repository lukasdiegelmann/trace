import { Navigate, useLocation } from "react-router";

import { readStartPage } from "@/features/shared/startPage";

import { oauthResult } from "../lib/insights/oauth";

/**
 * `/` leads to this device's start page (Settings > Appearance); a
 * wearable's OAuth callback, which ends there with
 * `?<provider>=connected|error`, goes on to Wellness with its query.
 */
export function StartRedirect() {
  const { search } = useLocation();
  const isWearableReturn = oauthResult(new URLSearchParams(search)) !== null;
  return (
    <Navigate
      to={isWearableReturn ? `/nutrition/wellness${search}` : readStartPage()}
      replace
    />
  );
}
