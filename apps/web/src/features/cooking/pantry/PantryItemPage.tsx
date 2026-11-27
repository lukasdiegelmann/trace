import { Button, Row, Stack, Text } from "@monocircuit/monolithium/components";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

import { PantryItemEditor } from "./PantryItemEditor";

/** /cooking/pantry/new, /:id and /:id/edit: deep links to one item */
export function PantryItemPage({ shouldEdit = false }) {
  const { t } = useTranslation("cooking");
  const navigate = useNavigate();
  const { id } = useParams();
  const itemId = id === undefined ? null : Number(id);
  const toList = () => void navigate("/cooking/pantry");

  if (itemId !== null && !Number.isInteger(itemId)) {
    return (
      <Stack padding={4} gap={3}>
        <Text role="alert">{t("pantryItem.invalid")}</Text>
        <Button
          variant="secondary"
          size="md"
          text={t("pantryItem.back")}
          onClick={toList}
        />
      </Stack>
    );
  }

  return (
    <PantryItemEditor
      key={`${itemId ?? "new"}:${shouldEdit ? "edit" : "view"}`}
      itemId={itemId}
      shouldEdit={shouldEdit}
      onClose={toList}
      onChanged={() => undefined}
    >
      {({ title, actions, body }) => (
        <Stack gap={4} padding={4} className="mx-auto w-full max-w-2xl">
          <Row gap={2} align="center" justify="between" shouldWrap>
            <Row gap={2} align="center">
              <Button
                size="sm"
                aria-label={t("pantryItem.back")}
                onClick={toList}
              >
                <ArrowLeft aria-hidden size={18} />
              </Button>
              <Text variant="title" as="h1">
                {title}
              </Text>
            </Row>
            <Row gap={2}>{actions}</Row>
          </Row>
          {body}
        </Stack>
      )}
    </PantryItemEditor>
  );
}
