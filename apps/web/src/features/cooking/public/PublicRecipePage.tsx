import {
  Button,
  Chip,
  ExternalLink,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { CloudOff, Link2Off } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

import { NutritionFactsBox } from "../common/NutritionFactsBox";
import { assetUrl } from "../lib/assetUrl";
import { domainFromUrl, formatDate } from "../lib/dates";
import { formatDuration } from "../lib/duration";
import { stepsOf } from "../recipesApi";
import { IngredientsSection } from "../recipes/view/IngredientsSection";
import { RichText } from "../recipes/view/RichText";
import { StepsSection } from "../recipes/view/StepsSection";
import { ToolList } from "../recipes/view/ToolList";
import { TimerOverlay } from "../timers/TimerOverlay";
import { startTimer } from "../timers/timers";

import { getPublicRecipe, LinkGoneError, type PublicRecipe } from "./publicApi";

type State =
  | { name: "loading" }
  | { name: "ready"; recipe: PublicRecipe }
  | { name: "gone" }
  | { name: "failed" };

/** The link's token must not travel on, and search engines stay away */
function usePrivateLinkMeta(): void {
  useEffect(() => {
    const tags = [
      ["robots", "noindex, nofollow"],
      ["referrer", "no-referrer"],
    ].map(([name, content]) => {
      const meta = document.createElement("meta");
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
      return meta;
    });
    return () => {
      for (const tag of tags) tag.remove();
    };
  }, []);
}

function Recipe({ recipe }: { recipe: PublicRecipe }) {
  const { t, i18n } = useTranslation("cooking");
  const [scale, setScale] = useState(1);
  const steps = stepsOf(recipe);
  const author =
    recipe.created_by_full_name || recipe.created_by_username || "";
  const domain = domainFromUrl(recipe.source_url);
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  const facts: [string, string][] = [
    [t("recipeView.prep"), formatDuration(recipe.prep_minutes)],
    [t("recipeView.cook"), formatDuration(recipe.cook_minutes)],
    [t("recipeView.total"), formatDuration(total)],
    [t("recipeView.serves"), recipe.servings ? String(recipe.servings) : ""],
    [t("recipeView.yield"), recipe.yield_text ?? ""],
  ];

  return (
    <Stack gap={5}>
      {assetUrl(recipe.img_url) ? (
        <img
          src={assetUrl(recipe.img_url)}
          alt=""
          className="max-h-[min(60vh,32rem)] w-full rounded-container bg-level-1 object-contain"
        />
      ) : null}
      <Stack gap={2}>
        {recipe.category ? (
          <Chip className="self-start" text={recipe.category.name} />
        ) : null}
        <Text variant="title" as="h1">
          {recipe.name}
        </Text>
        {recipe.description ? (
          <Text shouldKeepLineBreaks>{recipe.description}</Text>
        ) : null}
        <Row gap={2} shouldWrap align="center">
          {author ? (
            <Text variant="caption" tone="muted">
              {t("recipes.shared.by", { name: author })}
            </Text>
          ) : null}
          {recipe.created_at ? (
            <Text variant="caption" tone="muted">
              {formatDate(recipe.created_at, "natural", i18n.language)}
            </Text>
          ) : null}
          {domain && recipe.source_url ? (
            <ExternalLink
              variant="caption"
              href={recipe.source_url}
              text={t("recipeView.from", { domain })}
            />
          ) : null}
        </Row>
        <Row gap={5} shouldWrap paddingTop={2}>
          {facts
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <Stack gap={0} key={label}>
                <Text variant="label" tone="muted">
                  {label}
                </Text>
                <Text>{value}</Text>
              </Stack>
            ))}
        </Row>
      </Stack>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.2fr)] print:block">
        <Stack gap={5}>
          <IngredientsSection
            groups={recipe.ingredients}
            servings={recipe.servings}
            scale={scale}
            onScale={setScale}
            hasServingsInput={false}
          />
          <ToolList tools={recipe.tools} />
          <NutritionFactsBox
            nutrition={recipe.nutrition}
            servings={recipe.servings}
          />
        </Stack>
        <Stack gap={5}>
          <StepsSection
            isPublic
            steps={steps}
            groups={recipe.ingredients}
            onTimer={(index, durationSec) => {
              startTimer({
                label: `${recipe.name} · ${t("recipeView.step", { number: index + 1 })}`,
                durationSec,
                stepIndex: index,
              });
            }}
          />
          {recipe.notes ? (
            <Stack gap={2} as="section">
              <Text variant="heading" as="h2">
                {t("recipeView.notes")}
              </Text>
              <RichText html={recipe.notes} />
            </Stack>
          ) : null}
        </Stack>
      </div>
    </Stack>
  );
}

function PublicRecipeView({ token }: { token: string }) {
  const { t } = useTranslation("cooking");
  usePrivateLinkMeta();
  const [state, setState] = useState<State>({ name: "loading" });

  const load = useCallback(
    () =>
      getPublicRecipe(token).then(
        (recipe) => {
          setState({ name: "ready", recipe });
        },
        (caught: unknown) => {
          setState(
            caught instanceof LinkGoneError
              ? { name: "gone" }
              : { name: "failed" },
          );
        },
      ),
    [token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const title = state.name === "ready" ? state.recipe.name : "";
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className="h-full overflow-y-auto bg-level-0 print:h-auto print:overflow-visible">
      <Stack as="main" gap={4} padding={4} className="mx-auto w-full max-w-5xl">
        <Text variant="label" tone="muted">
          {t("publicRecipe.brand")}
        </Text>
        {state.name === "loading" ? (
          <Stack align="center" padding={8}>
            <Spinner size="lg" label={t("cookingCommon.loading")} />
          </Stack>
        ) : state.name === "ready" ? (
          <Recipe recipe={state.recipe} />
        ) : state.name === "gone" ? (
          <Stack align="center" gap={2} padding={8}>
            <Link2Off aria-hidden size={40} />
            <Text variant="heading" as="h1" align="center">
              {t("publicRecipe.gone")}
            </Text>
            <Text tone="muted" align="center">
              {t("publicRecipe.goneHint")}
            </Text>
          </Stack>
        ) : (
          <Stack align="center" gap={3} padding={8}>
            <CloudOff aria-hidden size={40} />
            <Text align="center" role="alert">
              {t("publicRecipe.failed")}
            </Text>
            <Button
              size="md"
              variant="primary"
              text={t("cookingCommon.retry")}
              onClick={() => {
                setState({ name: "loading" });
                void load();
              }}
            />
          </Stack>
        )}
        <Text variant="caption" tone="muted" align="center">
          {t("publicRecipe.footer")}
        </Text>
      </Stack>
      <TimerOverlay />
    </div>
  );
}

/** `/r/:token`: a shared recipe, for anyone with the link */
export function PublicRecipePage() {
  const { token = "" } = useParams();
  return <PublicRecipeView key={token} token={token} />;
}
