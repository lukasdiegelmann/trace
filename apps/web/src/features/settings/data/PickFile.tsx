import { FileInput } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

/** A file button that acts as soon as a file is chosen */
export function PickFile({
  accept,
  text,
  onPick,
  isDisabled,
}: {
  accept: string;
  text: string;
  onPick: (file: File) => void;
  isDisabled?: boolean;
}) {
  const { t } = useTranslation("settings");
  return (
    <FileInput
      accept={accept}
      text={text}
      placeholder={t("importExport.noFile")}
      disabled={isDisabled}
      file={null}
      onChange={(file) => {
        if (file) onPick(file);
      }}
    />
  );
}
