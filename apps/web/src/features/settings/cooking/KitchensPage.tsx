import {
  Button,
  Disclosure,
  EmptyState,
  KeyValue,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useBackendUser } from "../common/admin";
import { SelectRow, SwitchRow, TextRow } from "../common/fields";
import { LoadState, Section, SettingsScreen } from "../common/SettingsScreen";
import { useAction } from "../common/useAction";
import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";
import {
  kitchensApi,
  resolveInvitee,
  type Kitchen,
  type KitchenMember,
  type Peer,
} from "./kitchensApi";

function KitchenDetails({
  kitchen,
  peers,
  onChanged,
}: {
  kitchen: Kitchen;
  peers: Peer[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation("settings");
  const me = useBackendUser("ct");
  const members = useLoad(() => kitchensApi.members(kitchen.id), [kitchen.id]);
  const { isBusy, run } = useAction();
  const { confirm, dialog } = useConfirm();
  const [invitee, setInvitee] = useState("");
  const [inviteRole, setInviteRole] = useState<"sous" | "member">("member");
  const isOwner = kitchen.role === "owner";
  const others = (members.data ?? []).filter((m) => m.user_id !== me?.id);
  const nameOf = (member: KitchenMember) => member.full_name || member.username;
  const reload = async () => {
    await Promise.all([members.reload(), onChanged()]);
  };

  const setAutoShare = async (isOn: boolean) => {
    if (isOn) {
      const isConfirmed = await confirm({
        title: t("kitchens.autoShare"),
        message: t(
          others.length
            ? "kitchens.autoShareConfirm"
            : "kitchens.autoShareAlone",
        ),
        confirmText: t("kitchens.autoShareAction"),
      });
      if (!isConfirmed) return;
    }
    await run(
      async () => {
        await kitchensApi.autoShare(kitchen.id, isOn);
        await reload();
      },
      { success: t(isOn ? "kitchens.autoShareOn" : "kitchens.autoShareOff") },
    );
  };

  const setAll = (role: "sous" | "member") =>
    run(async () => {
      for (const member of others.filter((m) => m.role !== "owner")) {
        await kitchensApi.setRole(kitchen.id, member.user_id, role);
      }
    }).then(() => reload());

  const changeRole = async (member: KitchenMember, role: string) => {
    if (role === "owner") {
      const isConfirmed = await confirm({
        title: t("kitchens.makeOwnerTitle", { name: nameOf(member) }),
        message: t("kitchens.makeOwnerText"),
        confirmText: t("kitchens.makeOwner"),
        isDangerous: true,
      });
      if (!isConfirmed) return;
      await run(() => kitchensApi.setOwner(kitchen.id, member.user_id));
    } else {
      await run(() =>
        kitchensApi.setRole(
          kitchen.id,
          member.user_id,
          role === "sous" ? "sous" : "member",
        ),
      );
    }
    await reload();
  };

  const remove = async (userId: number, isLeaving: boolean, name: string) => {
    const isConfirmed = await confirm({
      title: isLeaving
        ? t("kitchens.leaveTitle", { name: kitchen.name })
        : t("kitchens.removeTitle", { name }),
      message: t(isLeaving ? "kitchens.leaveText" : "kitchens.removeText"),
      confirmText: t(isLeaving ? "kitchens.leave" : "actions.remove"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    await run(async () => {
      await kitchensApi.removeMember(kitchen.id, userId);
      await onChanged();
    });
    await members.reload();
  };

  return (
    <Stack gap={3} paddingY={3}>
      <SwitchRow
        label={t("kitchens.autoShare")}
        hint={t("kitchens.autoShareCount", {
          count: kitchen.auto_shared_count ?? 0,
        })}
        isChecked={kitchen.auto_share}
        isDisabled={isBusy}
        onChange={(isOn) => void setAutoShare(isOn)}
      />
      <LoadState
        isLoading={members.isLoading}
        error={members.error}
        onRetry={() => void members.reload()}
        hasData={members.data !== null}
      >
        {(members.data ?? []).map((member) => {
          const canEdit = isOwner && member.user_id !== me?.id;
          return (
            <Stack key={member.user_id} gap={2}>
              <KeyValue
                label={nameOf(member)}
                hint={`@${member.username}`}
                value={t(`kitchens.roles.${member.role}`)}
              />
              {canEdit ? (
                <Row gap={2} align="end" shouldWrap>
                  <SelectRow<string>
                    label={t("kitchens.roleOf", { name: nameOf(member) })}
                    value={member.role}
                    options={(["member", "sous", "owner"] as const).map(
                      (value) => ({
                        value,
                        label: t(`kitchens.roles.${value}`),
                      }),
                    )}
                    onChange={(role) => void changeRole(member, role)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    text={t("actions.remove")}
                    onClick={() =>
                      void remove(member.user_id, false, nameOf(member))
                    }
                  />
                </Row>
              ) : null}
            </Stack>
          );
        })}
      </LoadState>
      {others.length > 0 ? (
        <Text variant="caption" tone="muted">
          {t("kitchens.roleHelp")}
        </Text>
      ) : null}
      {isOwner && others.length > 0 ? (
        <Row gap={2} shouldWrap>
          <Button
            variant="secondary"
            size="sm"
            text={t("kitchens.everyoneEdits")}
            isDisabled={isBusy}
            onClick={() => void setAll("sous")}
          />
          <Button
            variant="secondary"
            size="sm"
            text={t("kitchens.nobodyEdits")}
            isDisabled={isBusy}
            onClick={() => void setAll("member")}
          />
        </Row>
      ) : null}
      {isOwner ? (
        <Stack gap={2}>
          <TextRow
            label={t("kitchens.invite")}
            hint={
              peers.length
                ? t("kitchens.inviteHint", {
                    names: peers.map((p) => p.username).join(", "),
                  })
                : undefined
            }
            value={invitee}
            isLive
            onCommit={setInvitee}
          />
          <SelectRow<"sous" | "member">
            label={t("kitchens.inviteRole")}
            value={inviteRole}
            options={(["member", "sous"] as const).map((value) => ({
              value,
              label: t(`kitchens.roles.${value}`),
            }))}
            onChange={setInviteRole}
          />
          <Row gap={2} shouldWrap>
            <Button
              variant="secondary"
              size="sm"
              text={t("kitchens.inviteAction")}
              isDisabled={!invitee.trim() || isBusy}
              onClick={() =>
                void run(async () => {
                  await kitchensApi.invite(
                    kitchen.id,
                    resolveInvitee(invitee, peers),
                    inviteRole,
                  );
                  setInvitee("");
                  await reload();
                })
              }
            />
            <Button
              variant="danger"
              size="sm"
              text={t("kitchens.delete")}
              onClick={() =>
                void confirm({
                  title: t("kitchens.deleteTitle", { name: kitchen.name }),
                  message: t("kitchens.deleteText"),
                  confirmText: t("actions.delete"),
                  isDangerous: true,
                }).then((isConfirmed) => {
                  if (!isConfirmed) return;
                  void run(async () => {
                    await kitchensApi.remove(kitchen.id);
                    await onChanged();
                  });
                })
              }
            />
          </Row>
        </Stack>
      ) : me ? (
        <Row>
          <Button
            variant="danger"
            size="sm"
            text={t("kitchens.leave")}
            onClick={() => void remove(me.id, true, kitchen.name)}
          />
        </Row>
      ) : null}
      {dialog}
    </Stack>
  );
}

export function KitchensPage() {
  const { t } = useTranslation("settings");
  const kitchens = useLoad(() => kitchensApi.list(), []);
  const peers = useLoad(() => kitchensApi.peers(), []);
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const { isBusy, run } = useAction();
  const create = () =>
    run(async () => {
      await kitchensApi.create(name.trim().slice(0, 80));
      setName("");
      await kitchens.reload();
    });

  return (
    <SettingsScreen
      title={t("topics.kitchens.title")}
      description={t("kitchens.description")}
    >
      <Section title={t("kitchens.yours")}>
        <LoadState
          isLoading={kitchens.isLoading}
          error={kitchens.error}
          onRetry={() => void kitchens.reload()}
          hasData={kitchens.data !== null}
        >
          {kitchens.data?.length === 0 ? (
            <EmptyState text={t("kitchens.empty")} />
          ) : null}
          {kitchens.data?.map((kitchen) => (
            <Disclosure
              key={kitchen.id}
              title={`${kitchen.name} · ${t(`kitchens.roles.${kitchen.role}`)}`}
              count={kitchen.member_count}
              hasDivider
              isOpen={openId === kitchen.id}
              onOpenChange={(isOpen) => {
                setOpenId(isOpen ? kitchen.id : null);
              }}
            >
              {openId === kitchen.id ? (
                <KitchenDetails
                  kitchen={kitchen}
                  peers={peers.data ?? []}
                  onChanged={kitchens.reload}
                />
              ) : null}
            </Disclosure>
          ))}
        </LoadState>
      </Section>
      <Section title={t("kitchens.new")}>
        <TextRow
          label={t("kitchens.name")}
          value={name}
          isLive
          onCommit={setName}
          onSubmit={() => {
            // Enter in an empty field, or while saving, creates nothing.
            if (name.trim() && !isBusy) void create();
          }}
        />
        <Row>
          <Button
            variant="secondary"
            size="md"
            text={t("kitchens.create")}
            isDisabled={!name.trim()}
            isLoading={isBusy}
            onClick={() => void create()}
          />
        </Row>
      </Section>
    </SettingsScreen>
  );
}
