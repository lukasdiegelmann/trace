/**
 * Mounted once in the app shell: opens the setup assistant for a fresh
 * account (once per browser session, only when entering the app) and, like
 * the old apps on start, saves the device's time zone for the servers'
 * schedulers where none is set.
 */
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

import { settingsStores, useSettings } from "@/features/shared/settings";
import { readStartPage } from "@/features/shared/startPage";

import { deviceTimezone } from "../lib/units";
import { needsSetup } from "../lib/onboarding";

const SHOWN_KEY = "trace.onboardingShown";

export function OnboardingGate() {
  const nt = useSettings("nt");
  const ct = useSettings("ct");
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const zone = deviceTimezone();
    if (!zone) return;
    if (nt.status === "ready" && !nt.values.timezone) {
      settingsStores.nt.set("timezone", zone);
    }
    if (ct.status === "ready" && !ct.values.timezone) {
      settingsStores.ct.set("timezone", zone);
    }
  }, [nt.status, ct.status, nt.values.timezone, ct.values.timezone]);

  const isFresh = nt.status === "ready" && needsSetup(nt.values);

  useEffect(() => {
    if (!isFresh || pathname !== readStartPage()) return;
    try {
      if (window.sessionStorage.getItem(SHOWN_KEY)) return;
      window.sessionStorage.setItem(SHOWN_KEY, "1");
    } catch {
      return;
    }
    void navigate("/settings/welcome");
  }, [isFresh, pathname, navigate]);

  return null;
}
