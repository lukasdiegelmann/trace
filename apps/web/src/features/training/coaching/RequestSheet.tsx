/**
 * Add Client: a name list and an optional note. Nothing of theirs is visible
 * until they accept (RequestSheet.svelte).
 */
import {
  Avatar,
  Button,
  Input,
  Pressable,
  Row,
  ScrollArea,
  Sheet,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { pickerName } from "@/features/training/lib/coaching";
import { includesFolded } from "@/features/training/lib/searchText";

import { coachingApi, type UnassignedPerson } from "./api";
import { coachingErrorText } from "./errorText";
import { useResource } from "./useResource";

export const NOTE_MAX = 500;

export interface RequestSheetProps {
  onClose: () => void;
  onSent: () => void;
}

export function RequestSheet({ onClose, onSent }: RequestSheetProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const people = useResource("unassigned", coachingApi.unassignedMembers);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<UnassignedPerson | null>(null);
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);

  const shown = (people.data ?? []).filter(
    (person) => !query.trim() || includesFolded(pickerName(person), query),
  );

  const send = async () => {
    if (!picked || isSending) return;
    setIsSending(true);
    const name = pickerName(picked);
    try {
      const answer = await coachingApi.requestClient(picked.id, note.trim());
      toast.info(
        answer.status === "pending"
          ? t("coaching.request.sent", { name })
          : t("coaching.request.added", { name }),
      );
      onClose();
      onSent();
    } catch (error) {
      toast.error(coachingErrorText(error, t, name));
      setIsSending(false);
    }
  };

  return (
    <Sheet
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("coaching.request.title")}
      footer={
        <Button
          variant="primary"
          size="md"
          isFullWidth
          text={
            picked
              ? t("coaching.request.sendTo", { name: pickerName(picked) })
              : t("coaching.request.send")
          }
          isDisabled={!picked}
          isLoading={isSending}
          onClick={() => {
            void send();
          }}
        />
      }
    >
      <Stack gap={3}>
        <Text variant="small" tone="muted">
          {t("coaching.request.intro")}
        </Text>
        <Input
          type="search"
          value={query}
          placeholder={t("coaching.request.search")}
          aria-label={t("coaching.request.search")}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        {people.isLoading ? (
          <Spinner label={t("common.loading")} />
        ) : people.error ? (
          <Text tone="muted" align="center" role="alert">
            {coachingErrorText(people.error, t)}
          </Text>
        ) : shown.length === 0 ? (
          <Text tone="muted" align="center">
            {t("coaching.request.nobody")}
          </Text>
        ) : (
          <ScrollArea
            as="ul"
            maxHeight="short"
            shouldGrow={false}
            border="all"
            radius="lg"
            aria-label={t("coaching.request.people")}
          >
            {shown.map((person) => {
              const isPicked = picked?.id === person.id;
              return (
                <li key={person.id}>
                  <Pressable
                    fill="width"
                    padding={2}
                    isPressed={isPicked}
                    className={isPicked ? "bg-accent/20" : undefined}
                    onPress={() => {
                      setPicked(person);
                    }}
                  >
                    <Row gap={3} align="center">
                      <span aria-hidden>
                        <Avatar name={pickerName(person)} size={32} />
                      </span>
                      <span className="min-w-0 flex-1 break-words">
                        {pickerName(person)}
                      </span>
                      {isPicked ? (
                        <CircleCheck
                          aria-hidden
                          size={18}
                          className="text-accent-text"
                        />
                      ) : null}
                    </Row>
                  </Pressable>
                </li>
              );
            })}
          </ScrollArea>
        )}
        <Input
          multiline
          rows={3}
          label={t("coaching.request.noteLabel")}
          placeholder={t("coaching.request.notePlaceholder")}
          maxChars={NOTE_MAX}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </Stack>
    </Sheet>
  );
}
