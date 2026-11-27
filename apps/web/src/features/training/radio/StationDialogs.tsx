/** Add or edit a station, rename a group */
import {
  Button,
  Dialog,
  Field,
  Input,
  Row,
  Stack,
  useToast,
} from "@monocircuit/monolithium/components";
import { ImageDown, Sparkles } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  EMPTY_STATION_FORM,
  newStationId,
  stationFromForm,
  stationToForm,
  type Station,
  type StationForm,
} from "../lib/radio";
import { fetchStationInfo, suggestStationIcon } from "./api";

interface FieldWithActionProps {
  children: ReactNode;
  action: ReactNode;
}

function FieldWithAction({ children, action }: FieldWithActionProps) {
  return (
    <Row gap={2} align="end">
      <Stack shouldGrow>{children}</Stack>
      {action}
    </Row>
  );
}

export interface StationDialogProps {
  /** null while adding */
  station: Station | null;
  /** Offered for the group field */
  groups: string[];
  onSave: (record: Station) => void;
  onClose: () => void;
}

/** Mount it to open it: the form starts from `station` */
export function StationDialog({
  station,
  groups,
  onSave,
  onClose,
}: StationDialogProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const groupListId = useId();
  const [form, setForm] = useState<StationForm>(() =>
    station ? stationToForm(station) : EMPTY_STATION_FORM,
  );
  const [isDetecting, setIsDetecting] = useState(false);
  const [isFetchingIcon, setIsFetchingIcon] = useState(false);

  const save = () => {
    const record = stationFromForm(
      form,
      station?.id || newStationId(Date.now()),
    );
    if (!record) {
      toast.error(t("radio.toast.nameUrlRequired"));
      return;
    }
    onSave(record);
  };

  const autoFill = async () => {
    const url = form.url.trim();
    if (!url) return;
    setIsDetecting(true);
    try {
      const info = await fetchStationInfo(url);
      // Only what is still empty is filled
      setForm((before) => ({
        ...before,
        name: before.name.trim() ? before.name : (info.name ?? ""),
        genre: before.genre.trim() ? before.genre : (info.genre ?? ""),
      }));
      if (!info.name && !info.genre) {
        toast.error(t("radio.toast.noMetadata"));
      }
    } catch {
      toast.error(t("radio.toast.cantProbe"));
    }
    setIsDetecting(false);
  };

  // The homepage has the real logos; a stream URL is often a CDN
  const iconSource = form.homepage.trim() || form.url.trim();
  const autoIcon = async () => {
    if (!iconSource) return;
    setIsFetchingIcon(true);
    try {
      const iconUrl = await suggestStationIcon(iconSource);
      if (iconUrl) setForm((before) => ({ ...before, iconUrl }));
      else toast.error(t("radio.toast.noIcon"));
    } catch {
      toast.error(t("radio.toast.noIcon"));
    }
    setIsFetchingIcon(false);
  };

  const field = (
    key: keyof StationForm,
    label: string,
    placeholder?: string,
    extra: { type?: string; list?: string; shouldAutoFocus?: boolean } = {},
  ) => (
    <Field label={label}>
      {(control) => (
        <Input
          {...control}
          type={extra.type}
          list={extra.list}
          autoFocus={extra.shouldAutoFocus}
          aria-label={label}
          placeholder={placeholder}
          value={form[key]}
          onChange={(event) => {
            const { value } = event.target;
            setForm((before) => ({ ...before, [key]: value }));
          }}
          onEnter={save}
        />
      )}
    </Field>
  );

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t(station ? "radio.dialog.editTitle" : "radio.dialog.addTitle")}
      confirmText={t("common.save")}
      cancelText={t("common.cancel")}
      onConfirm={save}
    >
      <Stack gap={3}>
        {field(
          "name",
          t("radio.dialog.name"),
          t("radio.dialog.namePlaceholder"),
          { shouldAutoFocus: true },
        )}
        <FieldWithAction
          action={
            <Button
              variant="secondary"
              size="md"
              text={t(
                isDetecting
                  ? "radio.dialog.detecting"
                  : "radio.dialog.autofill",
              )}
              isLoading={isDetecting}
              isDisabled={!form.url.trim()}
              onClick={() => void autoFill()}
            >
              <Sparkles aria-hidden className="size-4" />
            </Button>
          }
        >
          {field(
            "url",
            t("radio.dialog.url"),
            "https://ice1.somafm.com/groovesalad-128-mp3",
            { type: "url" },
          )}
        </FieldWithAction>
        {field("genre", t("radio.dialog.genre"), "Ambient / Downtempo")}
        {field(
          "homepage",
          t("radio.dialog.homepage"),
          "https://www.deejay.it",
          { type: "url" },
        )}
        {field(
          "group",
          t("radio.dialog.group"),
          t("radio.dialog.groupPlaceholder"),
          { list: groupListId },
        )}
        <datalist id={groupListId}>
          {groups.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>
        <FieldWithAction
          action={
            <Button
              variant="secondary"
              size="md"
              text={t("radio.dialog.autoIcon")}
              aria-label={t("radio.dialog.autoIconHint")}
              isLoading={isFetchingIcon}
              isDisabled={!iconSource}
              onClick={() => void autoIcon()}
            >
              <ImageDown aria-hidden className="size-4" />
            </Button>
          }
        >
          {field("iconUrl", t("radio.dialog.iconUrl"), "https://…/icon.png", {
            type: "url",
          })}
        </FieldWithAction>
      </Stack>
    </Dialog>
  );
}

export interface RenameGroupDialogProps {
  group: string;
  /** The trimmed new name; "" ungroups */
  onSave: (name: string) => void;
  onClose: () => void;
}

export function RenameGroupDialog({
  group,
  onSave,
  onClose,
}: RenameGroupDialogProps) {
  const { t } = useTranslation("training");
  const [name, setName] = useState(group);
  const save = () => {
    onSave(name.trim());
  };
  const label = t("radio.dialog.newName");
  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("radio.stations.renameGroup")}
      confirmText={t("common.save")}
      cancelText={t("common.cancel")}
      onConfirm={save}
    >
      <Field label={label}>
        {(control) => (
          <Input
            {...control}
            aria-label={label}
            autoFocus
            placeholder={t("radio.dialog.newNamePlaceholder")}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            onEnter={save}
          />
        )}
      </Field>
    </Dialog>
  );
}
