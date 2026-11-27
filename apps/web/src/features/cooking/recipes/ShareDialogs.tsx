import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Copy, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getCookbookShares,
  shareCookbook,
  shareCookbookWithKitchen,
  unshareCookbook,
  type Cookbook,
} from "../cookbooksApi";
import {
  createShareToken,
  getKitchens,
  getPeers,
  getRecipeShares,
  publicRecipeUrl,
  revokeShareToken,
  shareRecipe,
  shareRecipeWithKitchen,
  unshareRecipe,
  type Kitchen,
  type KitchenShareResult,
  type Peer,
  type Recipe,
} from "../recipesApi";

import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";
import { useNotify } from "../common/useNotify";

interface Targets {
  peers: Peer[];
  kitchens: Kitchen[];
  granted: Set<number>;
}

/** Each list may be refused (single-user mode, not the owner): then empty */
async function loadTargets(
  grants: () => Promise<{ user_id: number }[]>,
): Promise<Targets> {
  const [peers, kitchens, shares] = await Promise.all([
    getPeers().catch(() => [] as Peer[]),
    getKitchens().catch(() => [] as Kitchen[]),
    grants().catch(() => [] as { user_id: number }[]),
  ]);
  return {
    peers,
    kitchens,
    granted: new Set(shares.map((share) => share.user_id)),
  };
}

interface PeopleProps {
  targets: Targets;
  hint: string;
  shouldShowEmptyPeers?: boolean;
  onToggle: (userId: number, isGranted: boolean) => Promise<unknown>;
  onKitchen: (kitchenId: number) => Promise<KitchenShareResult>;
  onChanged: () => Promise<void>;
}

/** The "users" and "kitchens" parts both share dialogs have */
function PeopleSections({
  targets,
  hint,
  shouldShowEmptyPeers,
  onToggle,
  onKitchen,
  onChanged,
}: PeopleProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
      await onChanged();
    } catch (caught) {
      notify.failure(caught, t("recipes.share.failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {targets.peers.length > 0 || shouldShowEmptyPeers ? (
        <Stack gap={2} as="section">
          <Text variant="heading" as="h3">
            {t("recipes.share.users")}
          </Text>
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
          {targets.peers.length === 0 ? (
            <Text variant="small" tone="muted">
              {t("recipes.share.noUsers")}
            </Text>
          ) : null}
          {targets.peers.map((peer) => (
            <Checkbox
              key={peer.id}
              checked={targets.granted.has(peer.id)}
              disabled={busy !== null}
              label={
                peer.name === peer.username
                  ? peer.name
                  : `${peer.name} (@${peer.username})`
              }
              onChange={(isChecked) => {
                void run(`user-${peer.id}`, async () => {
                  await onToggle(peer.id, isChecked);
                });
              }}
            />
          ))}
        </Stack>
      ) : null}
      {targets.kitchens.length > 0 ? (
        <Stack gap={2} as="section">
          <Text variant="heading" as="h3">
            {t("recipes.share.kitchens")}
          </Text>
          {targets.kitchens.map((kitchen) => (
            <Row key={kitchen.id} justify="between" align="center" gap={2}>
              <Stack gap={0}>
                <Text>{kitchen.name}</Text>
                <Text variant="caption" tone="muted">
                  {t("recipes.share.members", { count: kitchen.member_count })}
                </Text>
              </Stack>
              <Button
                size="sm"
                variant="secondary"
                text={t("recipes.share.share")}
                isLoading={busy === `kitchen-${kitchen.id}`}
                isDisabled={busy !== null}
                onClick={() => {
                  void run(`kitchen-${kitchen.id}`, async () => {
                    const result = await onKitchen(kitchen.id);
                    notify.info(
                      result.added > 0
                        ? t("recipes.share.kitchenShared", {
                            count: result.added,
                            kitchen: kitchen.name,
                          })
                        : t("recipes.share.kitchenAlready", {
                            kitchen: kitchen.name,
                          }),
                    );
                  });
                }}
              />
            </Row>
          ))}
        </Stack>
      ) : null}
    </>
  );
}

export interface ShareRecipeDialogProps {
  recipe: Recipe;
  onClose: () => void;
  /** The public link was created or revoked */
  onTokenChange: (token: string | null) => void;
}

export function ShareRecipeDialog({
  recipe,
  onClose,
  onTokenChange,
}: ShareRecipeDialogProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const { confirm, dialog } = useConfirm();
  const { data, reload } = useLoad(
    useCallback(
      () => loadTargets(() => getRecipeShares(recipe.id)),
      [recipe.id],
    ),
  );
  const [token, setToken] = useState(recipe.share_token ?? null);
  const [isBusy, setIsBusy] = useState(false);
  const url = token ? publicRecipeUrl(token) : "";

  const mint = async (message: string) => {
    setIsBusy(true);
    try {
      const { share_token: next } = await createShareToken(recipe.id);
      setToken(next);
      onTokenChange(next);
      notify.info(message);
    } catch (caught) {
      notify.failure(caught, t("recipes.share.failed"));
    } finally {
      setIsBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      notify.info(t("recipes.share.copied"));
    } catch {
      notify.error(t("recipes.share.copyFailed"));
    }
  };

  const revoke = async () => {
    const isConfirmed = await confirm({
      title: t("recipes.share.revokeTitle"),
      message: t("recipes.share.revokeMessage"),
      confirmText: t("recipes.share.revoke"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    try {
      await revokeShareToken(recipe.id);
      setToken(null);
      onTokenChange(null);
      notify.info(t("recipes.share.revoked"));
    } catch (caught) {
      notify.failure(caught, t("recipes.share.failed"));
    }
  };

  return (
    <>
      <Dialog
        open
        onOpenChange={(isOpen) => {
          if (!isOpen) onClose();
        }}
        title={t("recipes.share.title")}
        description={recipe.name}
        cancelText={t("cookingCommon.close")}
      >
        {data ? (
          <Stack gap={6}>
            <PeopleSections
              targets={data}
              hint={t("recipes.share.recipeHint")}
              onToggle={(userId, isGranted) =>
                isGranted
                  ? shareRecipe(recipe.id, userId)
                  : unshareRecipe(recipe.id, userId)
              }
              onKitchen={(kitchenId) =>
                shareRecipeWithKitchen(kitchenId, recipe.id)
              }
              onChanged={() => reload({ isQuiet: true })}
            />
            <Stack gap={2} as="section">
              <Text variant="heading" as="h3">
                {t("recipes.share.publicLink")}
              </Text>
              <Text variant="caption" tone="muted">
                {t("recipes.share.publicHint")}
              </Text>
              {token ? (
                <>
                  <Input
                    readOnly
                    value={url}
                    aria-label={t("recipes.share.publicLink")}
                    onFocus={(event) => {
                      event.target.select();
                    }}
                  />
                  <Row gap={2} shouldWrap>
                    <Button
                      size="md"
                      variant="primary"
                      text={t("recipes.share.copy")}
                      onClick={() => void copy()}
                    >
                      <Copy aria-hidden size={16} />
                    </Button>
                    <Button
                      size="md"
                      variant="secondary"
                      text={t("recipes.share.rotate")}
                      isDisabled={isBusy}
                      onClick={() => void mint(t("recipes.share.rotated"))}
                    >
                      <RefreshCw aria-hidden size={16} />
                    </Button>
                    <Button
                      size="md"
                      variant="danger"
                      text={t("recipes.share.revoke")}
                      onClick={() => void revoke()}
                    >
                      <Trash2 aria-hidden size={16} />
                    </Button>
                  </Row>
                </>
              ) : (
                <Button
                  size="md"
                  variant="primary"
                  text={t("recipes.share.createLink")}
                  isLoading={isBusy}
                  onClick={() => void mint(t("recipes.share.linkCreated"))}
                />
              )}
            </Stack>
          </Stack>
        ) : (
          <Spinner label={t("cookingCommon.loading")} />
        )}
      </Dialog>
      {dialog}
    </>
  );
}

export interface ShareCookbookDialogProps {
  cookbook: Cookbook;
  onClose: () => void;
}

export function ShareCookbookDialog({
  cookbook,
  onClose,
}: ShareCookbookDialogProps) {
  const { t } = useTranslation("cooking");
  const { data, reload } = useLoad(
    useCallback(
      () => loadTargets(() => getCookbookShares(cookbook.id)),
      [cookbook.id],
    ),
  );
  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("recipes.share.cookbookTitle")}
      description={cookbook.name}
      cancelText={t("cookingCommon.close")}
    >
      {data ? (
        <Stack gap={6}>
          <PeopleSections
            targets={data}
            hint={t("recipes.share.cookbookHint")}
            shouldShowEmptyPeers
            onToggle={(userId, isGranted) =>
              isGranted
                ? shareCookbook(cookbook.id, userId)
                : unshareCookbook(cookbook.id, userId)
            }
            onKitchen={(kitchenId) =>
              shareCookbookWithKitchen(kitchenId, cookbook.id)
            }
            onChanged={() => reload({ isQuiet: true })}
          />
        </Stack>
      ) : (
        <Spinner label={t("cookingCommon.loading")} />
      )}
    </Dialog>
  );
}
