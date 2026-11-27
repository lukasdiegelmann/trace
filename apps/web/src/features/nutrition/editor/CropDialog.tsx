import {
  Slider,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppDialog } from "../components/AppDialog";
import { centeredSquareCrop, type SquareCrop } from "../lib/cropGeometry";
import { cropImageDataUrl, loadImage } from "./imageData";

/**
 * The square cut out of a new photo (`cropPhotos`).
 * TODO(monolithium): an image cropper with a draggable frame; sliders for
 * size and position until then.
 */
export function CropDialog({
  source,
  onCrop,
  onClose,
}: {
  source: string;
  onCrop: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const [image, setImage] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [crop, setCrop] = useState<SquareCrop>({ x: 0, y: 0, size: 0 });
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    void loadImage(source).then((loaded) => {
      if (!isCurrent) return;
      const size = {
        width: loaded.naturalWidth,
        height: loaded.naturalHeight,
      };
      setImage(size);
      setCrop(centeredSquareCrop(size.width, size.height));
    });
    return () => {
      isCurrent = false;
    };
  }, [source]);

  const maxSize = image ? Math.min(image.width, image.height) : 0;
  const clamp = (next: SquareCrop): SquareCrop => {
    if (!image) return next;
    const size = Math.min(Math.max(48, next.size), maxSize);
    return {
      size,
      x: Math.min(Math.max(0, next.x), image.width - size),
      y: Math.min(Math.max(0, next.y), image.height - size),
    };
  };
  const percent = (value: number, of: number) =>
    `${of > 0 ? (value / of) * 100 : 0}%`;

  return (
    <AppDialog
      title={t("editor.photo.cropTitle")}
      onClose={onClose}
      confirmText={t("editor.photo.useCrop")}
      isBusy={isBusy}
      onConfirm={async () => {
        if (!image) return;
        setIsBusy(true);
        onCrop(await cropImageDataUrl(source, crop));
        onClose();
      }}
    >
      {!image ? (
        <Spinner label={t("common.loading")} />
      ) : (
        <Stack gap={3}>
          <Text variant="caption">{t("editor.photo.cropHint")}</Text>
          <div className="relative mx-auto max-w-sm">
            <img src={source} alt="" className="block w-full opacity-50" />
            <div
              className="absolute overflow-hidden border-2 border-accent"
              style={{
                left: percent(crop.x, image.width),
                top: percent(crop.y, image.height),
                width: percent(crop.size, image.width),
                height: percent(crop.size, image.height),
              }}
            >
              <img
                src={source}
                alt=""
                className="absolute max-w-none"
                style={{
                  width: percent(image.width, crop.size),
                  left: `-${percent(crop.x, crop.size)}`,
                  top: `-${percent(crop.y, crop.size)}`,
                }}
              />
            </div>
          </div>
          <Slider
            label={t("editor.photo.size")}
            min={48}
            max={maxSize}
            value={crop.size}
            onChange={(size) => {
              setCrop(clamp({ ...crop, size }));
            }}
          />
          {image.width > crop.size && (
            <Slider
              label={t("editor.photo.horizontal")}
              min={0}
              max={image.width - crop.size}
              value={crop.x}
              onChange={(x) => {
                setCrop(clamp({ ...crop, x }));
              }}
            />
          )}
          {image.height > crop.size && (
            <Slider
              label={t("editor.photo.vertical")}
              min={0}
              max={image.height - crop.size}
              value={crop.y}
              onChange={(y) => {
                setCrop(clamp({ ...crop, y }));
              }}
            />
          )}
        </Stack>
      )}
    </AppDialog>
  );
}
