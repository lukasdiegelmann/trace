import {
  Button,
  Menu,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import { MoreVertical } from "lucide-react";
import type { ReactNode } from "react";

export interface RowMenuProps {
  items: MenuItem[];
  label: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  icon?: ReactNode;
}

/**
 * A row's actions behind a "more" button. Controlled, so the row can also
 * open it on right-click or a long press (`onContextMenu`).
 *
 * TODO(monolithium): Button doesn't forward the props `Menu` puts on its
 * trigger, so a span stands in between.
 */
export function RowMenu({
  items,
  label,
  isOpen,
  onOpenChange,
  icon,
}: RowMenuProps) {
  return (
    <Menu
      items={items}
      label={label}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      align="end"
      hasExternalTrigger
    >
      {/* Button takes no trigger props, so the menu anchors to this span */}
      <span className="inline-flex shrink-0">
        <Button
          size="sm"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => {
            onOpenChange(!isOpen);
          }}
        >
          {icon ?? <MoreVertical aria-hidden size={16} />}
        </Button>
      </span>
    </Menu>
  );
}
