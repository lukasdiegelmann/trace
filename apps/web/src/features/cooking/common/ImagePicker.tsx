import {
  Button,
  FileInput,
  Input,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Camera, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { assetUrl } from "../lib/assetUrl";
import { uploadImage } from "../uploads";
import { CameraDialog } from "./CameraDialog";
import { useNotify } from "./useNotify";

export interface ImagePickerProps {
  /** The stored URL: "/uploads/…" or an external one; "" for none */
  value: string;
  onChange: (url: string) => void;
  /** The field's label */
  label: string;
  /** While a photo uploads, e.g. to hold back Save */
  onBusyChange?: (isBusy: boolean) => void;
}

/**
 * A photo: upload a file, take one with the camera, or use an image URL.
 * TODO(monolithium): an image field (preview, upload, camera, URL)
 */
export function ImagePicker({
  value,
  onChange,
  label,
  onBusyChange,
}: ImagePickerProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [url, setUrl] = useState("");

  const upload = async (file: Blob, name?: string) => {
    setIsUploading(true);
    onBusyChange?.(true);
    try {
      onChange(await uploadImage(file, name));
    } catch (error) {
      notify.failure(error, t("cookingCommon.photo.uploadFailed"));
    } finally {
      setIsUploading(false);
      onBusyChange?.(false);
    }
  };

  const useUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setUrl("");
  };

  return (
    <Stack gap={2} role="group" aria-label={label}>
      <Text variant="label">{label}</Text>
      {value ? (
        <Row gap={2} align="end">
          <img
            src={assetUrl(value)}
            alt={t("cookingCommon.photo.preview")}
            className="size-40 rounded-container object-cover"
          />
          <Button
            variant="danger"
            size="sm"
            text={t("cookingCommon.photo.remove")}
            onClick={() => {
              onChange("");
            }}
          >
            <Trash2 aria-hidden size={14} />
          </Button>
        </Row>
      ) : null}
      {isUploading ? (
        <Spinner label={t("cookingCommon.photo.uploading")} />
      ) : (
        <Row gap={2} align="center" shouldWrap>
          <FileInput
            accept="image/*"
            text={t("cookingCommon.photo.choose")}
            placeholder={t("cookingCommon.photo.noFile")}
            file={null}
            onChange={(file) => {
              if (file) void upload(file, file.name);
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            text={t("cookingCommon.photo.camera")}
            onClick={() => {
              setIsCameraOpen(true);
            }}
          >
            <Camera aria-hidden size={14} />
          </Button>
        </Row>
      )}
      <Row gap={2} align="end">
        <Input
          label={t("cookingCommon.photo.url")}
          value={url}
          inputMode="url"
          wrapperClassName="min-w-0 flex-1"
          onChange={(event) => {
            setUrl(event.target.value);
          }}
          onEnter={useUrl}
        />
        <Button
          variant="secondary"
          size="md"
          text={t("cookingCommon.photo.useUrl")}
          isDisabled={!url.trim()}
          onClick={useUrl}
        />
      </Row>
      {isCameraOpen ? (
        <CameraDialog
          onClose={() => {
            setIsCameraOpen(false);
          }}
          onCapture={(photo) => {
            setIsCameraOpen(false);
            void upload(photo);
          }}
        />
      ) : null}
    </Stack>
  );
}
