import {
  AvatarPicker,
  Banner,
  Button,
  KeyValue,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, BACKEND_IDS, type BackendId, type BackendUser } from "@/api";
import { useAuth } from "@/auth/AuthContext";

import { useBackendUser } from "../common/admin";
import { useShared } from "../common/binding";
import { SelectRow, TextRow } from "../common/fields";
import { Section, SettingsScreen } from "../common/SettingsScreen";
import { useAction } from "../common/useAction";
import { useConfirm } from "../common/useConfirm";
import { backendAssetUrl } from "../lib/assets";
import { GENDERS, profileGender, type Gender } from "../lib/body";
import { isoDate } from "../lib/dates";
import { mergedProfile, type ProfileDraft } from "../lib/profile";
import { isEmail } from "../lib/admin";
import { BodyData } from "./BodyData";
import { LinkedAccounts } from "./LinkedAccounts";

function field(user: BackendUser | null, name: string): string {
  const value = user?.[name];
  return typeof value === "string" ? value : "";
}

/** One profile, saved to all three apps (each keeps its own copy) */
function ProfileForm({ user }: { user: BackendUser }) {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const { sessions, refresh } = useAuth();
  const [draft, setDraft] = useState<ProfileDraft>(() =>
    mergedProfile(
      BACKEND_IDS.map((backend) => {
        const session = sessions?.[backend];
        return session?.state === "signed-in" ? session.user : null;
      }),
    ),
  );
  const [start] = useState(draft);
  /** A picture chosen now: each app gets its own upload when saved */
  const [picture, setPicture] = useState<{
    file: File;
    preview: string;
  } | null>(null);
  const [, setDob] = useShared<string>(["nt", "dob"], ["lt", "dob"]);
  const [, setSettingGender] = useShared<string>(
    ["nt", "gender"],
    ["lt", "gender"],
  );
  const { isBusy, run } = useAction();
  const set = (patch: Partial<ProfileDraft>) => {
    setDraft((old) => ({ ...old, ...patch }));
  };
  const isBadEmail = draft.email !== "" && !isEmail(draft.email);
  const avatar = picture
    ? picture.preview
    : field(user, "avatar_url")
      ? backendAssetUrl("nt", field(user, "avatar_url"))
      : null;

  const saveTo = async (backend: BackendId) => {
    const session = sessions?.[backend];
    if (session?.state !== "signed-in") return;
    let avatarUrl = field(session.user, "avatar_url");
    if (picture) {
      const form = new FormData();
      form.append("file", picture.file);
      avatarUrl = (await api[backend].post<{ url: string }>("/upload", form))
        .url;
    }
    // nt and ct clear what is left out: always send all six.
    await api[backend].put("/auth/profile", {
      full_name: draft.full_name || null,
      nickname: draft.nickname || null,
      email: draft.email || null,
      birthday: draft.birthday || null,
      gender: profileGender(backend, draft.gender) || null,
      avatar_url: avatarUrl || null,
    });
  };

  const save = () =>
    run(
      async () => {
        const results = await Promise.allSettled(BACKEND_IDS.map(saveTo));
        // The apps' calculations read these from the settings.
        // A field that was empty all along leaves the setting alone.
        if (draft.birthday || start.birthday) setDob(draft.birthday);
        if (draft.gender || start.gender) setSettingGender(draft.gender);
        await refresh();
        const failed = results.flatMap((result, index) =>
          result.status === "rejected"
            ? [
                `${tCommon(`backends.${BACKEND_IDS[index] ?? "nt"}`)}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
              ]
            : [],
        );
        if (failed.length) throw new Error(failed.join("; "));
        setPicture(null);
      },
      { success: t("actions.saved") },
    );

  return (
    <Section title={t("profile.details")} hint={t("profile.detailsHint")}>
      <AvatarPicker
        src={avatar}
        name={draft.nickname || draft.full_name || user.username}
        onFile={(file) => {
          if (picture) URL.revokeObjectURL(picture.preview);
          setPicture({ file, preview: URL.createObjectURL(file) });
        }}
        accept="image/*"
        labels={{
          trigger: t("profile.avatar.trigger"),
          menu: t("profile.avatar.menu"),
          change: t("profile.avatar.change"),
          drop: t("profile.avatar.drop"),
          upload: t("profile.avatar.upload"),
          useUrl: t("profile.avatar.useUrl"),
          remove: t("profile.avatar.remove"),
        }}
      />
      <TextRow
        label={t("profile.fullName")}
        value={draft.full_name}
        onCommit={(full_name) => {
          set({ full_name });
        }}
      />
      <TextRow
        label={t("profile.nickname")}
        value={draft.nickname}
        onCommit={(nickname) => {
          set({ nickname });
        }}
      />
      <TextRow
        type="email"
        label={t("profile.email")}
        value={draft.email}
        error={isBadEmail ? t("users.badEmail") : undefined}
        onCommit={(email) => {
          set({ email });
        }}
      />
      <TextRow
        type="date"
        label={t("profile.birthday")}
        value={draft.birthday}
        error={
          draft.birthday > isoDate(new Date())
            ? t("profile.birthdayFuture")
            : undefined
        }
        onCommit={(birthday) => {
          set({ birthday });
        }}
      />
      <SelectRow<Gender | "">
        label={t("profile.gender")}
        value={draft.gender}
        options={[
          { value: "", label: t("profile.genders.unset") },
          ...GENDERS.map((value) => ({
            value,
            label: t(`profile.genders.${value}`),
          })),
        ]}
        onChange={(gender) => {
          set({ gender });
        }}
      />
      <Row>
        <Button
          variant="primary"
          size="md"
          text={t("actions.save")}
          isLoading={isBusy}
          isDisabled={isBadEmail || draft.birthday > isoDate(new Date())}
          onClick={() => void save()}
        />
      </Row>
    </Section>
  );
}

function Account() {
  const { t } = useTranslation("settings");
  const { t: tAuth } = useTranslation("auth");
  const { t: tCommon } = useTranslation();
  const { sessions, signOut, isRedirecting, signOutFailed, refresh } =
    useAuth();
  const { run } = useAction();
  const { confirm, dialog } = useConfirm();

  const deleteAccount = async (backend: BackendId) => {
    const app = tCommon(`backends.${backend}`);
    const isConfirmed = await confirm({
      title: t("profile.deleteTitle", { app }),
      message: t("profile.deleteText", { app }),
      confirmText: t("profile.delete"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    await run(async () => {
      await api[backend].delete("/auth/me");
      await refresh();
    });
  };

  return (
    <>
      <Section title={t("profile.account")}>
        {BACKEND_IDS.map((backend) => {
          const session = sessions?.[backend];
          const user = session?.state === "signed-in" ? session.user : null;
          return (
            <KeyValue
              key={backend}
              label={tCommon(`backends.${backend}`)}
              value={
                user ? `@${user.username ?? user.id}` : t("profile.signedOut")
              }
            />
          );
        })}
        {signOutFailed.length > 0 ? (
          <Banner
            text={tAuth("signOut.incomplete", {
              backends: signOutFailed
                .map((backend) => tCommon(`backends.${backend}`))
                .join(", "),
            })}
            actionText={tAuth("signOut.retry")}
            onAction={() => void signOut()}
          />
        ) : null}
        <Row>
          <Button
            variant="secondary"
            size="md"
            text={tAuth("signOut.action")}
            isLoading={isRedirecting}
            onClick={() => void signOut()}
          />
        </Row>
      </Section>
      <Section title={t("profile.danger")} hint={t("profile.dangerHint")}>
        <Stack gap={2}>
          {BACKEND_IDS.map((backend) => (
            <Row key={backend}>
              <Button
                variant="danger"
                size="sm"
                text={t("profile.deleteIn", {
                  app: tCommon(`backends.${backend}`),
                })}
                onClick={() => void deleteAccount(backend)}
              />
            </Row>
          ))}
        </Stack>
        {dialog}
      </Section>
    </>
  );
}

export function ProfilePage() {
  const { t } = useTranslation("settings");
  const user = useBackendUser("nt");
  return (
    <SettingsScreen
      title={t("topics.profile.title")}
      description={t("topics.profile.description")}
      backends={["nt", "lt"]}
    >
      {user ? (
        <ProfileForm key={user.id} user={user} />
      ) : (
        <Text tone="muted">{t("profile.signedOut")}</Text>
      )}
      <BodyData />
      <LinkedAccounts />
      <Account />
    </SettingsScreen>
  );
}
