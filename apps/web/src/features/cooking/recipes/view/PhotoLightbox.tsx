import { Button, Dialog, Row, Text } from "@monocircuit/monolithium/components";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { assetUrl } from "../../lib/assetUrl";

export interface PhotoLightboxProps {
  photos: string[];
  startAt: number;
  onClose: () => void;
}

/**
 * One photo large, with arrows (keys too) through the others.
 * TODO(monolithium): an image lightbox.
 */
export function PhotoLightbox({
  photos,
  startAt,
  onClose,
}: PhotoLightboxProps) {
  const { t } = useTranslation("cooking");
  const [index, setIndex] = useState(startAt);
  const move = (step: number) => {
    setIndex((current) =>
      Math.min(photos.length - 1, Math.max(0, current + step)),
    );
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  });

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("recipeView.photo")}
      cancelText={t("cookingCommon.close")}
    >
      <img
        src={assetUrl(photos[index])}
        alt={t("recipeView.photo")}
        className="max-h-[65dvh] w-full object-contain"
      />
      {photos.length > 1 ? (
        <Row justify="center" align="center" gap={3} paddingTop={3}>
          <Button
            size="sm"
            variant="secondary"
            aria-label={t("recipeView.previousPhoto")}
            isDisabled={index === 0}
            onClick={() => {
              move(-1);
            }}
          >
            <ChevronLeft aria-hidden size={18} />
          </Button>
          <Text variant="mono">
            {index + 1} / {photos.length}
          </Text>
          <Button
            size="sm"
            variant="secondary"
            aria-label={t("recipeView.nextPhoto")}
            isDisabled={index === photos.length - 1}
            onClick={() => {
              move(1);
            }}
          >
            <ChevronRight aria-hidden size={18} />
          </Button>
        </Row>
      ) : null}
    </Dialog>
  );
}

/** Small photos that open the lightbox */
export function PhotoStrip({
  photos,
  onRemove,
}: {
  photos: string[];
  onRemove?: (index: number) => void;
}) {
  const { t } = useTranslation("cooking");
  const [openAt, setOpenAt] = useState<number | null>(null);
  if (photos.length === 0) return null;
  return (
    <Row gap={2} shouldWrap>
      {photos.map((photo, index) => (
        <div key={`${index}-${photo}`} className="flex flex-col gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label={t("recipeView.openPhoto", { number: index + 1 })}
            onClick={() => {
              setOpenAt(index);
            }}
          >
            <img
              src={assetUrl(photo)}
              alt=""
              loading="lazy"
              className="size-20 rounded-control object-cover"
            />
          </Button>
          {onRemove ? (
            <Button
              variant="ghost"
              size="sm"
              text={t("cookingCommon.remove")}
              aria-label={t("recipeView.removePhoto", { number: index + 1 })}
              onClick={() => {
                onRemove(index);
              }}
            />
          ) : null}
        </div>
      ))}
      {openAt === null ? null : (
        <PhotoLightbox
          photos={photos}
          startAt={openAt}
          onClose={() => {
            setOpenAt(null);
          }}
        />
      )}
    </Row>
  );
}
