import {
  Button,
  Input,
  Menu,
  Row,
  Stack,
} from "@monocircuit/monolithium/components";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Palette,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  prefixLines,
  wrapSelection,
  type Selection,
} from "../../lib/markdownEdit";

/** The text colours the old editor offers; they are the note's content */
const TEXT_COLOURS = [
  { id: "red", value: "#EF4444" },
  { id: "orange", value: "#F59E0B" },
  { id: "yellow", value: "#EAB308" },
  { id: "green", value: "#10B981" },
  { id: "blue", value: "#3B82F6" },
  { id: "purple", value: "#A855F7" },
  { id: "pink", value: "#EC4899" },
] as const;

export interface FormattedFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
  /** Strike-through and colour too (notes) */
  isRich?: boolean;
}

/**
 * A text area with formatting buttons that write markers.
 * TODO(monolithium): a markdown / rich text editor.
 */
export function FormattedField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  hint,
  isRich,
}: FormattedFieldProps) {
  const { t } = useTranslation("cooking");
  const field = useRef<HTMLInputElement>(null);

  const apply = (change: (selection: Selection) => Selection) => {
    const element = field.current;
    const next = change({
      text: value,
      start: element?.selectionStart ?? value.length,
      end: element?.selectionEnd ?? value.length,
    });
    onChange(next.text);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(next.start, next.end);
    });
  };

  const tool = (
    key: "bold" | "italic" | "underline" | "strike" | "bullets" | "numbers",
    icon: ReactNode,
    change: (selection: Selection) => Selection,
  ) => (
    <Button
      variant="ghost"
      size="sm"
      aria-label={t(`recipeEditor.format.${key}`)}
      onClick={() => {
        apply(change);
      }}
    >
      {icon}
    </Button>
  );

  return (
    <Stack gap={1}>
      <Row gap={0} shouldWrap role="toolbar" aria-label={label}>
        {tool("bold", <Bold aria-hidden size={14} />, (s) =>
          wrapSelection(s, "**"),
        )}
        {tool("italic", <Italic aria-hidden size={14} />, (s) =>
          wrapSelection(s, "*"),
        )}
        {tool("underline", <Underline aria-hidden size={14} />, (s) =>
          wrapSelection(s, "__"),
        )}
        {isRich ? (
          <>
            {tool("strike", <Strikethrough aria-hidden size={14} />, (s) =>
              wrapSelection(s, "~~"),
            )}
            <Menu
              label={t("recipeEditor.format.colour")}
              items={TEXT_COLOURS.map((colour) => ({
                id: colour.id,
                text: t(`recipeEditor.colours.${colour.id}`),
                onSelect: () => {
                  apply((s) => wrapSelection(s, "[", `]{${colour.value}}`));
                },
              }))}
            >
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("recipeEditor.format.colour")}
              >
                <Palette aria-hidden size={14} />
              </Button>
            </Menu>
          </>
        ) : null}
        {tool("bullets", <List aria-hidden size={14} />, (s) =>
          prefixLines(s, false),
        )}
        {tool("numbers", <ListOrdered aria-hidden size={14} />, (s) =>
          prefixLines(s, true),
        )}
      </Row>
      <Input
        multiline
        rows={rows}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        inputElementRef={field}
        onValueChange={onChange}
      />
      {hint ? <span className="text-caption text-muted">{hint}</span> : null}
    </Stack>
  );
}
