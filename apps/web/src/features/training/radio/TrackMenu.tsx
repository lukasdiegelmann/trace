import { Menu, useToast } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { addToQueue, playNext } from "./player";
import type { MenuAt } from "./TrackRow";

export interface TrackMenuProps {
  at: MenuAt | null;
  onClose: () => void;
}

/** A track's context menu, at the pointer; Menu keeps it on the screen */
export function TrackMenu({ at, onClose }: TrackMenuProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  if (!at) return null;
  return (
    <Menu
      key={`${at.x}:${at.y}`}
      isOpen
      hasExternalTrigger
      sideOffset={0}
      label={t("radio.trackOptions")}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      items={[
        {
          id: "next",
          text: t("radio.playNext"),
          onSelect: () => {
            playNext(at.track);
            toast.info(t("radio.toast.playingNext"));
          },
        },
        {
          id: "queue",
          text: t("radio.addToQueue"),
          onSelect: () => {
            addToQueue(at.track);
            toast.info(t("radio.toast.addedToQueue"));
          },
        },
      ]}
    >
      <span
        aria-hidden
        className="fixed size-0"
        style={{ left: at.x, top: at.y }}
      />
    </Menu>
  );
}
