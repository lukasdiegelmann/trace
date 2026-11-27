import { Text } from "@monocircuit/monolithium/components";
import { CloudOff, Image as ImageIcon, ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { loadCoachPhoto, type CoachPhotoResult } from "./photos";

/** A photo in a conversation, with its states: loading, gone, no connection */
export function CoachPhoto({ path }: { path: string }) {
  const { t } = useTranslation("training");
  const [loaded, setLoaded] = useState<{
    path: string;
    result: CoachPhotoResult;
  } | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void loadCoachPhoto(path).then((result) => {
      if (isCurrent) setLoaded({ path, result });
    });
    return () => {
      isCurrent = false;
    };
  }, [path]);

  const result = loaded?.path === path ? loaded.result : null;
  if (result?.kind === "ready") {
    return (
      <img
        src={result.url}
        alt={t("conversation.photo")}
        loading="lazy"
        className="block max-h-80 max-w-64 rounded-control object-cover"
      />
    );
  }
  const note =
    result?.kind === "gone"
      ? t("conversation.photoGone")
      : result?.kind === "error"
        ? t("conversation.photoOffline")
        : null;
  const PlaceholderIcon =
    result?.kind === "gone"
      ? ImageOff
      : result?.kind === "error"
        ? CloudOff
        : ImageIcon;
  return (
    <div
      role="img"
      aria-label={note ?? t("conversation.photo")}
      className="flex h-36 w-52 max-w-full flex-col items-center justify-center gap-1 rounded-control bg-level-3 p-2 text-center text-muted"
    >
      <PlaceholderIcon aria-hidden size={24} />
      {note ? <Text variant="caption">{note}</Text> : null}
    </div>
  );
}
