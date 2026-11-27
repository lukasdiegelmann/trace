import {
  Button,
  Menu,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import { EllipsisVertical } from "lucide-react";

/**
 * A row's actions behind a "more" button: the old UI's long-press action
 * sheet, reachable without a long press.
 */
export function RowMenu({
  label,
  items,
  isOpen,
  onOpenChange,
}: {
  /** The button's accessible name, e.g. "Actions for Milk" */
  label: string;
  items: MenuItem[];
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}) {
  return (
    <Menu
      items={items}
      label={label}
      align="end"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <Button size="sm" aria-label={label}>
        <EllipsisVertical aria-hidden size={16} />
      </Button>
    </Menu>
  );
}
