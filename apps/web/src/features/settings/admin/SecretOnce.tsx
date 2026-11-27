import {
  Button,
  CodeBlock,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

/** A new token or secret: shown this once, with its copy button */
export function SecretOnce({
  title,
  secret,
  onDone,
}: {
  title: string;
  secret: string;
  onDone: () => void;
}) {
  const { t } = useTranslation("settings");
  return (
    <Stack gap={2} role="status">
      <Text variant="label">{title}</Text>
      <Text variant="small" tone="warning">
        {t("tokens.onlyOnce")}
      </Text>
      <CodeBlock code={secret} copyable shouldWrap />
      <Row>
        <Button
          variant="secondary"
          size="sm"
          text={t("tokens.savedIt")}
          onClick={onDone}
        />
      </Row>
    </Stack>
  );
}
