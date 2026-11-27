import {
  Button,
  Chip,
  FileInput,
  Input,
  Row,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ltAssetUrl } from "../common/assets";
import {
  type MediaFields,
  mediaKindOfUrl,
  singleMedia,
  youTubeEmbedUrl,
  youTubeId,
} from "../lib/exerciseMedia";
import { uploadExerciseMedia } from "./api";

export interface MediaInputProps {
  value: Required<MediaFields>;
  onChange: (value: Required<MediaFields>) => void;
}

/** One image, GIF or video of an exercise: uploaded or by URL */
export function MediaInput({ value, onChange }: MediaInputProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const kind = value.video_url
    ? "video"
    : value.gif_url
      ? "gif"
      : value.img_url
        ? "img"
        : null;
  const preview = value.video_url || value.gif_url || value.img_url || "";
  const video = youTubeId(value.video_url);

  const upload = async (file: File | null) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const uploaded = await uploadExerciseMedia(file);
      onChange(singleMedia(uploaded.kind, uploaded.url));
    } catch (error) {
      toast.error(t("common.error", { message: (error as Error).message }));
    } finally {
      setIsUploading(false);
    }
  };

  const applyUrl = () => {
    const next = url.trim();
    if (!next) return;
    onChange(singleMedia(mediaKindOfUrl(next), next));
    setUrl("");
  };

  return (
    <Stack gap={2}>
      {kind && (
        <Stack gap={2}>
          <div className="aspect-video w-full overflow-hidden rounded-container bg-level-2">
            {video ? (
              <iframe
                className="size-full"
                src={youTubeEmbedUrl(video)}
                title={t("exerciseEditor.media.preview")}
                allowFullScreen
              />
            ) : kind === "video" ? (
              <video
                className="size-full object-contain"
                src={ltAssetUrl(preview)}
                poster={ltAssetUrl(value.img_url || value.gif_url)}
                controls
                preload="metadata"
              />
            ) : (
              <img
                className="size-full object-contain"
                src={ltAssetUrl(preview)}
                alt={t("exerciseEditor.media.preview")}
              />
            )}
          </div>
          <Row gap={2} justify="between" align="center">
            <Chip tone="muted" text={t(`exerciseEditor.media.kind.${kind}`)} />
            <Button
              size="sm"
              text={t("exerciseEditor.media.remove")}
              onClick={() => {
                onChange({ img_url: "", gif_url: "", video_url: "" });
              }}
            >
              <X aria-hidden size={16} />
            </Button>
          </Row>
        </Stack>
      )}
      {isUploading ? (
        <Spinner label={t("exerciseEditor.media.uploading")} />
      ) : (
        <FileInput
          accept="image/*,video/*"
          variant="secondary"
          text={t("exerciseEditor.media.upload")}
          placeholder={t("exerciseEditor.media.noFile")}
          file={null}
          onChange={(file) => void upload(file)}
        />
      )}
      <Row gap={2} align="end">
        <div className="min-w-0 flex-1">
          <Input
            type="url"
            aria-label={t("exerciseEditor.media.url")}
            placeholder={t("exerciseEditor.media.url")}
            value={url}
            onValueChange={setUrl}
            onEnter={applyUrl}
          />
        </div>
        <Button
          variant="secondary"
          aria-label={t("exerciseEditor.media.apply")}
          isDisabled={!url.trim()}
          onClick={applyUrl}
        >
          <Check aria-hidden size={16} />
        </Button>
      </Row>
      <Text variant="caption" tone="muted">
        {t("exerciseEditor.media.hint")}
      </Text>
    </Stack>
  );
}
