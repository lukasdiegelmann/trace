import {
  Button,
  FileInput,
  Input,
  Row,
  Stack,
} from "@monocircuit/monolithium/components";
import { Camera, Link, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { assetUrl } from "../api";
import { useNotify } from "../components/useNotify";
import { useNtSettings } from "../settings";
import { CameraDialog } from "./CameraDialog";
import { CropDialog } from "./CropDialog";
import { fitImageDataUrl, readFileAsDataUrl } from "./imageData";

/**
 * The photo of a food or meal: camera, upload or a link. New pictures are
 * cropped (`cropPhotos`) or shrunk; the server stores what it is sent.
 */
export function PhotoField({
  value,
  onChange,
}: {
  /** A stored URL or a data: URL; "" for none */
  value: string;
  onChange: (url: string) => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const notify = useNotify();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cropping, setCropping] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const take = async (dataUrl: string) => {
    if (settings.cropPhotos) {
      setCropping(dataUrl);
      return;
    }
    try {
      onChange(await fitImageDataUrl(dataUrl));
    } catch {
      notify.error(t("editor.photo.invalid"));
    }
  };
  const applyLink = () => {
    if (link?.trim()) onChange(link.trim());
    setLink(null);
  };

  return (
    <Stack gap={2}>
      {value && (
        <div className="relative w-fit">
          <img
            src={assetUrl(value)}
            alt={t("editor.photo.label")}
            referrerPolicy="no-referrer"
            className="max-h-48 rounded-container object-contain"
          />
          <div className="absolute top-1 right-1">
            <Button
              size="sm"
              variant="secondary"
              aria-label={t("editor.photo.remove")}
              onClick={() => {
                onChange("");
              }}
            >
              <X aria-hidden size={16} />
            </Button>
          </div>
        </div>
      )}
      <Row gap={2} shouldWrap align="center">
        <Button
          size="sm"
          variant="secondary"
          text={t("editor.photo.camera")}
          onClick={() => {
            setIsCameraOpen(true);
          }}
        >
          <Camera aria-hidden size={14} />
        </Button>
        <FileInput
          accept="image/*"
          file={null}
          // The photo above shows the choice; the default text is English
          // TODO(monolithium): translatable built-in strings
          placeholder=" "
          text={t("editor.photo.upload")}
          size="sm"
          variant="secondary"
          onChange={(file) => {
            if (!file) return;
            void readFileAsDataUrl(file).then(take);
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          text={t("editor.photo.url")}
          aria-expanded={link !== null}
          onClick={() => {
            setLink(link === null ? "" : null);
          }}
        >
          <Link aria-hidden size={14} />
        </Button>
      </Row>
      {link !== null && (
        <Row gap={2} align="end">
          <div className="min-w-0 flex-1">
            <Input
              type="url"
              label={t("editor.photo.urlLabel")}
              placeholder="https://"
              value={link}
              onValueChange={setLink}
              onEnter={applyLink}
              autoFocus
              fieldSize="md"
            />
          </div>
          <Button
            size="md"
            variant="primary"
            text={t("editor.photo.get")}
            onClick={applyLink}
          />
        </Row>
      )}
      {isCameraOpen && (
        <CameraDialog
          onCapture={(dataUrl) => void take(dataUrl)}
          onClose={() => {
            setIsCameraOpen(false);
          }}
        />
      )}
      {cropping && (
        <CropDialog
          source={cropping}
          onCrop={onChange}
          onClose={() => {
            setCropping(null);
          }}
        />
      )}
    </Stack>
  );
}
