import {
  Button,
  Chip,
  FileInput,
  Input,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useNotify } from "../../common/useNotify";
import { assetUrl } from "../../lib/assetUrl";
import { uploadImage } from "../../uploads";

export interface VideoFieldProps {
  value: string;
  onChange: (url: string) => void;
  isUploading: boolean;
  onUploading: (isUploading: boolean) => void;
}

const isUpload = (url: string) => /^\/?uploads\//.test(url);

/** A recipe video: recorded, uploaded, or a link */
export function VideoField({
  value,
  onChange,
  isUploading,
  onUploading,
}: VideoFieldProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();

  const upload = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      notify.error(t("recipeEditor.video.notVideo"));
      return;
    }
    onUploading(true);
    try {
      onChange(await uploadImage(file, file.name));
      notify.success(t("recipeEditor.video.uploaded"));
    } catch (caught) {
      notify.failure(caught, t("cookingCommon.photo.uploadFailed"));
    }
    onUploading(false);
  };

  return (
    <Stack gap={2} role="group" aria-label={t("recipeEditor.video.label")}>
      <Text variant="label">{t("recipeEditor.video.label")}</Text>
      {isUploading ? (
        <Spinner label={t("recipeEditor.video.uploading")} />
      ) : (
        <FileInput
          accept="video/*"
          capture="environment"
          text={t("recipeEditor.video.upload")}
          captureText={t("recipeEditor.video.record")}
          placeholder={t("cookingCommon.photo.noFile")}
          file={null}
          onChange={(file) => {
            if (file) void upload(file);
          }}
        />
      )}
      <Input
        type="url"
        aria-label={t("recipeEditor.video.url")}
        placeholder={t("recipeEditor.video.url")}
        value={isUpload(value) ? "" : value}
        onValueChange={onChange}
      />
      {value ? (
        <Stack gap={2}>
          <Row gap={2} align="center">
            <Chip
              text={
                isUpload(value)
                  ? t("recipeEditor.video.local")
                  : t("recipeEditor.video.external")
              }
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("recipeEditor.video.remove")}
              onClick={() => {
                onChange("");
              }}
            >
              <X aria-hidden size={14} />
            </Button>
          </Row>
          {isUpload(value) ? (
            <video
              controls
              preload="metadata"
              src={assetUrl(value)}
              className="max-h-72 w-full rounded-container bg-level-2"
            />
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
