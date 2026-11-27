/** The saved stations in their groups, with reordering by buttons or drag */
import {
  Button,
  Dialog,
  Pressable,
  Row,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  GripVertical,
  Pencil,
  Plus,
  Radio,
  Trash2,
} from "lucide-react";
import { useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";

import {
  canMove,
  deleteStation,
  dropOnGroup,
  dropOnStation,
  existingGroups,
  groupKey,
  groupStations,
  moveStation,
  renameGroup,
  upsertStation,
  type Station,
} from "../lib/radio";
import { EmptyNote } from "../common/EmptyNote";
import { PlayerArt } from "./PlayerArt";
import { RenameGroupDialog, StationDialog } from "./StationDialogs";
import { usePlayer } from "./usePlayer";

const COLLAPSE_KEY = "lt:collapsedStationGroups";

function readCollapsed(): ReadonlySet<string> {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(COLLAPSE_KEY) ?? "[]",
    );
    return new Set(Array.isArray(saved) ? saved.map(String) : []);
  } catch {
    return new Set();
  }
}

export interface MyStationsProps {
  stations: Station[];
  onChange: (stations: Station[]) => void;
  onPlay: (station: Station) => void;
}

type DialogState =
  | { type: "station"; station: Station | null }
  | { type: "rename"; group: string }
  | { type: "delete"; station: Station }
  | null;

interface DropTarget {
  type: "station" | "group";
  key: string;
}

export function MyStations({ stations, onChange, onPlay }: MyStationsProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const currentTrack = usePlayer("currentTrack");
  const nowPlaying = usePlayer("streamNowPlaying");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<DropTarget | null>(null);
  const close = () => {
    setDialog(null);
  };

  const toggleGroup = (name: string) => {
    const key = groupKey(name);
    const next = new Set(collapsed);
    if (!next.delete(key)) next.add(key);
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]));
    } catch {
      // blocked storage: collapsed for this visit only
    }
  };

  const endDrag = () => {
    setDragId(null);
    setOver(null);
  };
  const dragOver = (event: DragEvent, target: DropTarget) => {
    if (!dragId || (target.type === "station" && target.key === dragId)) {
      return;
    }
    event.preventDefault();
    setOver(target);
  };
  const drop = (event: DragEvent, next: (dragged: string) => Station[]) => {
    event.preventDefault();
    if (dragId) onChange(next(dragId));
    endDrag();
  };
  const isOver = (type: DropTarget["type"], key: string) =>
    over?.type === type && over.key === key;

  const stationRow = (station: Station) => {
    const isCurrent = currentTrack?.id === station.id;
    const { name } = station;
    return (
      <div
        key={station.id}
        role="listitem"
        draggable
        className={`flex items-center gap-1 rounded-control border ${isOver("station", station.id) ? "border-accent" : "border-transparent"} ${isCurrent ? "bg-level-2" : ""} ${dragId === station.id ? "opacity-50" : ""}`}
        onDragStart={(event) => {
          setDragId(station.id);
          // Firefox starts no drag without data; tests have no dataTransfer
          (event.dataTransfer as DataTransfer | null)?.setData(
            "text/plain",
            station.id,
          );
        }}
        onDragOver={(event) => {
          dragOver(event, { type: "station", key: station.id });
        }}
        onDrop={(event) => {
          drop(event, (dragged) =>
            dropOnStation(stations, dragged, station.id),
          );
        }}
        onDragEnd={endDrag}
      >
        <span
          title={t("radio.stations.dragHint")}
          className="cursor-grab text-muted [@media(hover:none)]:hidden"
        >
          <GripVertical aria-hidden className="size-4" />
        </span>
        <Stack>
          {(["up", "down"] as const).map((direction) => (
            <Button
              key={direction}
              className="h-6"
              aria-label={t(
                direction === "up"
                  ? "radio.stations.moveUp"
                  : "radio.stations.moveDown",
                { name },
              )}
              isDisabled={!canMove(stations, station.id, direction)}
              onClick={() => {
                onChange(moveStation(stations, station.id, direction));
              }}
            >
              {direction === "up" ? (
                <ChevronsUp aria-hidden className="size-3.5" />
              ) : (
                <ChevronsDown aria-hidden className="size-3.5" />
              )}
            </Button>
          ))}
        </Stack>
        <Pressable
          shouldGrow
          paddingX={2}
          paddingY={1}
          onPress={() => {
            onPlay(station);
          }}
        >
          <Row gap={3} align="center">
            <PlayerArt
              className="size-10"
              sources={[station.iconUrl || undefined]}
              fallback={<Radio className="size-5" />}
            />
            <Stack shouldGrow>
              <Text as="span" isTruncated>
                {name}
              </Text>
              <Text
                as="span"
                variant="caption"
                tone={isCurrent && nowPlaying ? "accent" : "muted"}
                isTruncated
              >
                {isCurrent && nowPlaying
                  ? `♪ ${nowPlaying}`
                  : station.genre || t("radio.stations.fallbackGenre")}
              </Text>
            </Stack>
          </Row>
        </Pressable>
        <Button
          size="sm"
          aria-label={t("radio.stations.edit", { name })}
          onClick={() => {
            setDialog({ type: "station", station });
          }}
        >
          <Pencil aria-hidden className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="danger"
          aria-label={t("radio.stations.delete", { name })}
          onClick={() => {
            setDialog({ type: "delete", station });
          }}
        >
          <Trash2 aria-hidden className="size-4" />
        </Button>
      </div>
    );
  };

  return (
    <Stack gap={3}>
      <Row justify="end">
        <Button
          variant="primary"
          size="sm"
          text={t("radio.stations.add")}
          onClick={() => {
            setDialog({ type: "station", station: null });
          }}
        >
          <Plus aria-hidden className="size-4" />
        </Button>
      </Row>

      {groupStations(stations).map((group) => {
        const isCollapsed = collapsed.has(groupKey(group.name));
        const label = group.name || t("radio.stations.ungrouped");
        return (
          <Stack key={groupKey(group.name)} gap={1}>
            <div
              className={`flex items-center gap-1 rounded-control border ${isOver("group", group.name) ? "border-accent" : "border-transparent"}`}
              onDragOver={(event) => {
                dragOver(event, { type: "group", key: group.name });
              }}
              onDrop={(event) => {
                drop(event, (dragged) =>
                  dropOnGroup(stations, dragged, group.name),
                );
              }}
            >
              <Pressable
                shouldGrow
                paddingY={1}
                isExpanded={!isCollapsed}
                label={t("radio.stations.toggleGroup", {
                  name: label,
                  count: group.stations.length,
                })}
                onPress={() => {
                  toggleGroup(group.name);
                }}
              >
                <Row gap={2} align="center">
                  {isCollapsed ? (
                    <ChevronRight aria-hidden className="size-4" />
                  ) : (
                    <ChevronDown aria-hidden className="size-4" />
                  )}
                  <Text as="span" variant="label">
                    {label}
                  </Text>
                  <Text as="span" variant="caption">
                    {group.stations.length}
                  </Text>
                </Row>
              </Pressable>
              <Button
                size="sm"
                aria-label={t("radio.stations.renameGroupNamed", {
                  name: label,
                })}
                onClick={() => {
                  setDialog({ type: "rename", group: group.name });
                }}
              >
                <Pencil aria-hidden className="size-3.5" />
              </Button>
            </div>
            {isCollapsed ? null : (
              <div role="list" className="grid gap-1 xl:grid-cols-2">
                {group.stations.map(stationRow)}
              </div>
            )}
          </Stack>
        );
      })}

      {stations.length === 0 ? (
        <EmptyNote
          icon={<Radio className="size-12" />}
          text={t("radio.stations.empty")}
        />
      ) : null}

      {dialog?.type === "station" ? (
        <StationDialog
          station={dialog.station}
          groups={existingGroups(stations)}
          onClose={close}
          onSave={(record) => {
            onChange(upsertStation(stations, record));
            close();
            toast.info(
              t(
                dialog.station
                  ? "radio.toast.stationUpdated"
                  : "radio.toast.stationAdded",
              ),
            );
          }}
        />
      ) : null}
      {dialog?.type === "rename" ? (
        <RenameGroupDialog
          group={dialog.group}
          onClose={close}
          onSave={(name) => {
            close();
            if (name === dialog.group.trim()) return;
            onChange(renameGroup(stations, dialog.group, name));
            toast.info(
              name
                ? t("radio.toast.renamedTo", { name })
                : t("radio.toast.movedUngrouped"),
            );
          }}
        />
      ) : null}
      {dialog?.type === "delete" ? (
        <Dialog
          open
          variant="danger"
          onOpenChange={(isOpen) => {
            if (!isOpen) close();
          }}
          title={t("radio.confirm.deleteTitle")}
          description={t("radio.confirm.deleteMessage", {
            name: dialog.station.name,
          })}
          confirmText={t("common.delete")}
          cancelText={t("common.cancel")}
          onConfirm={() => {
            onChange(deleteStation(stations, dialog.station.id));
            close();
          }}
        />
      ) : null}
    </Stack>
  );
}
