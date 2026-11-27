import { ExternalLink, Stack, Text } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { videoEmbed } from "../../lib/videoEmbed";

export function VideoBlock({ url }: { url: string | null }) {
  const { t } = useTranslation("cooking");
  const video = videoEmbed(url);
  if (!video) return null;
  return (
    <Stack gap={2} as="section" className="print:hidden">
      <Text variant="heading" as="h2">
        {t("recipeView.video")}
      </Text>
      {video.kind === "video" ? (
        <video
          controls
          preload="metadata"
          src={video.src}
          className="w-full rounded-container bg-level-2"
        />
      ) : video.kind === "iframe" ? (
        <iframe
          src={video.src}
          title={t("recipeView.video")}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full rounded-container border-0"
        />
      ) : (
        <ExternalLink href={video.src} text={t("recipeView.watchVideo")} />
      )}
    </Stack>
  );
}
