import {
  ActionList,
  Avatar,
  EmptyState,
  Input,
  Row,
  Stack,
  Text,
  Tile,
} from "@monocircuit/monolithium/components";
import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useAdminBackends, useBackendUser } from "./common/admin";
import { backendAssetUrl } from "./lib/assets";
import { OnboardingCards } from "./OnboardingCards";
import { matchesQuery, TOPIC_GROUPS, topicHref, withQuery } from "./topics";

export function SettingsPage() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const user = useBackendUser("nt");
  const isAdmin = useAdminBackends().length > 0;
  const [query, setQuery] = useState("");

  const groups = TOPIC_GROUPS.map((group) => ({
    id: group.id,
    topics: group.topics.filter(
      (topic) =>
        (!("isAdminOnly" in topic) || isAdmin) &&
        matchesQuery(
          {
            title: t(`topics.${topic.id}.title`),
            description: t(`topics.${topic.id}.description`),
            keywords: t(`topics.${topic.id}.keywords`),
          },
          query,
        ),
    ),
  })).filter((group) => group.topics.length > 0);

  const nickname =
    typeof user?.nickname === "string" ? user.nickname : undefined;
  const fullName =
    typeof user?.full_name === "string" ? user.full_name : undefined;
  const name = nickname || fullName || user?.username || "";
  const avatar = typeof user?.avatar_url === "string" ? user.avatar_url : null;

  return (
    <Stack gap={6} padding={6} maxWidth="lg">
      <Text variant="title" as="h1">
        {t("title")}
      </Text>
      {user ? (
        <Tile
          label={t("home.profile")}
          onPress={() => void navigate("/settings/profile")}
        >
          <Row gap={3} align="center">
            <Avatar
              src={avatar ? backendAssetUrl("nt", avatar) : null}
              name={name}
              size={48}
            />
            <Stack gap={1}>
              <Text variant="heading">{name}</Text>
              <Text variant="small" tone="muted">
                {isAdmin
                  ? `${t("home.profile")} · ${t("home.admin")}`
                  : t("home.profile")}
              </Text>
            </Stack>
          </Row>
        </Tile>
      ) : null}
      <Input
        aria-label={t("home.searchLabel")}
        placeholder={t("home.searchPlaceholder")}
        type="search"
        icon={<Search aria-hidden />}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      {query === "" ? <OnboardingCards /> : null}
      {groups.length === 0 ? (
        <EmptyState
          text={t("home.noMatches", { query })}
          action={{
            text: t("home.clearSearch"),
            onClick: () => {
              setQuery("");
            },
          }}
        />
      ) : null}
      {groups.map((group) => (
        <Stack as="section" key={group.id} gap={2}>
          <Text variant="heading" as="h2">
            {t(`groups.${group.id}`)}
          </Text>
          <ActionList
            label={t(`groups.${group.id}`)}
            items={group.topics.map((topic) => ({
              id: topic.id,
              text: t(`topics.${topic.id}.title`),
              description: t(`topics.${topic.id}.description`),
              onSelect: () =>
                void navigate(withQuery(topicHref(topic.path), query)),
            }))}
          />
        </Stack>
      ))}
    </Stack>
  );
}
