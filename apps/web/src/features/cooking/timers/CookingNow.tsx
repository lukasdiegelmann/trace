import { Button, Menu } from "@monocircuit/monolithium/components";
import { CookingPot } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { cookList, cookStore, type ActiveCook } from "./cooks";

const TICK_MS = 30_000;

/** The time, redrawn while the page is visible */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => {
      if (!document.hidden) setNow(Date.now());
    };
    const timer = setInterval(update, TICK_MS);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return now;
}

/**
 * What is being cooked while another page is open: one recipe opens
 * directly, several open a list. The recipe on screen is left out.
 */
export function CookingNow() {
  const { t } = useTranslation("cooking");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const all = useSyncExternalStore(cookStore.subscribe, cookStore.get);
  const now = useNow();
  const cooks = cookList(all).filter(
    (cook) => pathname !== `/cooking/recipes/${cook.id}`,
  );
  if (cooks.length === 0) return null;

  const [oldest] = cooks;
  const name = (cook: ActiveCook) => cook.name || t("timers.aRecipe");
  const since = (at: number) => {
    const minutes = Math.floor(Math.max(0, now - at) / 60_000);
    if (minutes < 1) return t("timers.justStarted");
    return minutes < 60
      ? t("timers.minutes", { minutes })
      : t("timers.hours", {
          hours: Math.floor(minutes / 60),
          minutes: minutes % 60,
        });
  };
  const open = (id: number) => void navigate(`/cooking/recipes/${id}`);

  const trigger = (onClick?: () => void) => (
    <Button
      size="md"
      variant="primary"
      text={
        cooks.length === 1
          ? `${name(oldest)} · ${since(oldest.at)}`
          : t("timers.cookingCount", {
              count: cooks.length,
              name: name(oldest),
            })
      }
      onClick={onClick}
    >
      <CookingPot aria-hidden size={18} />
    </Button>
  );

  return (
    <div className="fixed bottom-3 left-3 z-30 max-w-[min(23rem,calc(100vw-6rem))] rounded-control shadow-lg compact:bottom-[calc(5rem+env(safe-area-inset-bottom))] print:hidden">
      {cooks.length === 1 ? (
        trigger(() => {
          open(oldest.id);
        })
      ) : (
        <Menu
          label={t("timers.cookingList")}
          items={cooks.map((cook) => ({
            id: String(cook.id),
            text: name(cook),
            description: since(cook.at),
            onSelect: () => {
              open(cook.id);
            },
          }))}
        >
          {trigger()}
        </Menu>
      )}
    </div>
  );
}
