/**
 * The apps' user management. Invites, adding users and password resets are
 * left out: sign-in is SSO only and accounts appear at their first sign-in.
 */
import {
  Button,
  Dialog,
  Row,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type BackendId } from "@/api";

import { useBackendUser } from "../common/admin";
import { AdminPerApp } from "../common/AdminOnly";
import { SelectRow, TextRow } from "../common/fields";
import { LoadState, Section, SettingsScreen } from "../common/SettingsScreen";
import { useAction } from "../common/useAction";
import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";
import { isEmail, SESSION_HOURS } from "../lib/admin";

interface User {
  id: number;
  username: string;
  full_name?: string | null;
  email?: string | null;
  role: string;
  trainer_id?: number | null;
  coaching_requests?: { id: number; coach: { id: number; name: string } }[];
}

const ROLES: Record<BackendId, readonly string[]> = {
  nt: ["user", "admin"],
  ct: ["user", "admin"],
  lt: ["member", "trainer", "admin"],
};

const DATA_COUNTS = [
  "foods",
  "meals",
  "recipes",
  "diary_days",
  "wellness_data",
  "activities",
  "workouts",
] as const;

function displayName(user: User): string {
  return user.full_name || user.username;
}

/** NutriTrace shows what goes with a user and asks for their user name */
function DeleteWithCounts({
  user,
  onClose,
  onDelete,
}: {
  user: User;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("settings");
  const [typed, setTyped] = useState("");
  const counts = useLoad(
    () =>
      api.nt.get<Record<string, number>>(`/auth/users/${user.id}/data-counts`),
    [user.id],
  );
  return (
    <Dialog
      open
      variant="danger"
      title={t("users.deleteTitle", { name: displayName(user) })}
      description={t("users.deleteText")}
      cancelText={t("actions.cancel")}
      confirmText={t("actions.delete")}
      isConfirmDisabled={typed !== user.username}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      onConfirm={onDelete}
    >
      <Stack gap={3}>
        <LoadState
          isLoading={counts.isLoading}
          error={counts.error}
          hasData={counts.data !== null}
        >
          <Text variant="small">
            {DATA_COUNTS.map(
              (key) =>
                `${t(`users.counts.${key}`)}: ${counts.data?.[key] ?? 0}`,
            ).join(" · ")}
          </Text>
        </LoadState>
        <TextRow
          label={t("users.typeName", { username: user.username })}
          value={typed}
          isLive
          onCommit={setTyped}
        />
      </Stack>
    </Dialog>
  );
}

/** CookTrace lets an admin correct a user's name and address */
function EditUser({
  user,
  onSaved,
}: {
  user: User;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation("settings");
  const [name, setName] = useState(user.full_name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const { isBusy, run } = useAction();
  const isChanged =
    name !== (user.full_name ?? "") || email !== (user.email ?? "");
  const isBadEmail = email !== "" && !isEmail(email);
  return (
    <>
      <TextRow
        label={t("users.fullName", { username: user.username })}
        value={name}
        onCommit={setName}
      />
      <TextRow
        type="email"
        label={t("users.email", { username: user.username })}
        value={email}
        error={isBadEmail ? t("users.badEmail") : undefined}
        onCommit={setEmail}
      />
      {isChanged ? (
        <Row>
          <Button
            variant="secondary"
            size="sm"
            text={t("actions.save")}
            isDisabled={isBadEmail}
            isLoading={isBusy}
            onClick={() =>
              void run(
                async () => {
                  await api.ct.patch(`/auth/users/${user.id}`, {
                    full_name: name,
                    email,
                  });
                  await onSaved();
                },
                { success: t("actions.saved") },
              )
            }
          />
        </Row>
      ) : null}
    </>
  );
}

function SessionLifetime({ backend }: { backend: BackendId }) {
  const { t } = useTranslation("settings");
  const config = useLoad(
    () => api[backend].get<{ session_hours?: string }>("/app-config"),
    [backend],
  );
  const { run } = useAction();
  const hours = Number(config.data?.session_hours ?? 8760);
  if (!config.data) return null;
  return (
    <Section title={t("users.sessions")}>
      <SelectRow<number>
        label={t("users.sessionLifetime")}
        value={hours}
        options={SESSION_HOURS.map((value) => ({
          value,
          label: t(`users.lifetimes.h${value}`),
        }))}
        onChange={(value) =>
          void run(
            async () => {
              await api[backend].put("/app-config", {
                key: "session_hours",
                value: String(value),
              });
              await config.reload();
            },
            { success: t("actions.saved") },
          )
        }
      />
    </Section>
  );
}

function Users({ backend }: { backend: BackendId }) {
  const { t } = useTranslation("settings");
  const me = useBackendUser(backend);
  const users = useLoad(
    () => api[backend].get<User[]>("/auth/users"),
    [backend],
  );
  const { run } = useAction();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [deleting, setDeleting] = useState<User | null>(null);
  const list = users.data ?? [];
  const trainers = list.filter(
    (u) => u.role === "trainer" || u.role === "admin",
  );

  /** Reloads even after a refusal, so a select shows what the server has */
  const change = async (action: () => Promise<unknown>, success?: string) => {
    await run(action, { success });
    await users.reload();
  };
  const remove = (user: User) =>
    change(() => api[backend].delete(`/auth/users/${user.id}`));

  const setRole = async (user: User, role: string) => {
    if (backend !== "lt") {
      const isConfirmed = await confirm({
        title: t("users.roleTitle", { name: displayName(user) }),
        message: t("users.roleText", {
          role: t(`users.roles.${role as "user"}`),
        }),
        confirmText: t("users.changeRole"),
        isDangerous: user.role === "admin",
      });
      if (!isConfirmed) return;
    }
    await change(() =>
      api[backend].put(`/auth/users/${user.id}/role`, { role }),
    );
  };

  /** With consent, a new trainer is only asked: the select stays as it was */
  const setTrainer = async (user: User, trainerId: number) => {
    await run(async () => {
      const answer = await api.lt.put<{ status?: string | null } | undefined>(
        `/auth/users/${user.id}/trainer`,
        { trainer_id: trainerId || null },
      );
      toast.show({
        text: !trainerId
          ? t("users.trainerRemoved")
          : answer?.status === "pending"
            ? t("users.trainerRequested", { name: displayName(user) })
            : t("users.trainerAssigned"),
      });
    });
    await users.reload();
  };

  return (
    <>
      <LoadState
        isLoading={users.isLoading}
        error={users.error}
        onRetry={() => void users.reload()}
        hasData={users.data !== null}
      >
        <Text variant="small" tone="muted">
          {t("users.ssoHint")}
        </Text>
        {list.map((user) => {
          const isMe = user.id === me?.id;
          return (
            <Section
              key={user.id}
              title={`${displayName(user)}${isMe ? ` (${t("users.you")})` : ""}`}
              hint={[`@${user.username}`, user.email]
                .filter(Boolean)
                .join(" · ")}
            >
              {isMe ? (
                <Text variant="small">
                  {t(`users.roles.${user.role as "user"}`)}
                </Text>
              ) : (
                <SelectRow<string>
                  label={t("users.role", { name: displayName(user) })}
                  value={user.role}
                  options={ROLES[backend].map((value) => ({
                    value,
                    label: t(`users.roles.${value as "user"}`),
                  }))}
                  onChange={(role) => void setRole(user, role)}
                />
              )}
              {backend === "ct" && !isMe ? (
                <EditUser user={user} onSaved={users.reload} />
              ) : null}
              {backend === "lt" && user.role === "member" ? (
                <SelectRow<number>
                  label={t("users.trainer", { name: displayName(user) })}
                  value={user.trainer_id ?? 0}
                  options={[
                    { value: 0, label: t("users.noTrainer") },
                    ...trainers
                      .filter((trainer) => trainer.id !== user.id)
                      .map((trainer) => ({
                        value: trainer.id,
                        label: displayName(trainer),
                      })),
                  ]}
                  onChange={(id) => void setTrainer(user, id)}
                />
              ) : null}
              {user.coaching_requests?.map((request) => (
                <Row key={request.id} gap={2} align="center" shouldWrap>
                  <Text variant="small">
                    {t("users.pending", { coach: request.coach.name })}
                  </Text>
                  <Button
                    variant="ghost"
                    size="sm"
                    text={t("users.cancelRequest")}
                    onClick={() =>
                      void confirm({
                        title: t("users.cancelRequest"),
                        message: t("users.pending", {
                          coach: request.coach.name,
                        }),
                        confirmText: t("users.cancelRequest"),
                      }).then((isConfirmed) => {
                        if (isConfirmed) {
                          void change(() =>
                            api.lt.post(
                              `/coaching/pairings/${request.id}/end`,
                              {
                                expect: "pending",
                              },
                            ),
                          );
                        }
                      })
                    }
                  />
                </Row>
              ))}
              {!isMe ? (
                <Row>
                  <Button
                    variant="ghost"
                    size="sm"
                    text={t("users.delete")}
                    aria-label={`${t("users.delete")}: ${displayName(user)}`}
                    onClick={() => {
                      if (backend === "nt") {
                        setDeleting(user);
                        return;
                      }
                      void confirm({
                        title: t("users.deleteTitle", {
                          name: displayName(user),
                        }),
                        message: t("users.deleteText"),
                        confirmText: t("actions.delete"),
                        isDangerous: true,
                      }).then((isConfirmed) => {
                        if (isConfirmed) void remove(user);
                      });
                    }}
                  />
                </Row>
              ) : null}
            </Section>
          );
        })}
      </LoadState>
      <SessionLifetime backend={backend} />
      {deleting ? (
        <DeleteWithCounts
          user={deleting}
          onClose={() => {
            setDeleting(null);
          }}
          onDelete={() => {
            const user = deleting;
            setDeleting(null);
            void remove(user);
          }}
        />
      ) : null}
      {dialog}
    </>
  );
}

export function UsersPage() {
  const { t } = useTranslation("settings");
  return (
    <SettingsScreen
      title={t("topics.users.title")}
      description={t("topics.users.description")}
    >
      <AdminPerApp>{(backend) => <Users backend={backend} />}</AdminPerApp>
    </SettingsScreen>
  );
}
