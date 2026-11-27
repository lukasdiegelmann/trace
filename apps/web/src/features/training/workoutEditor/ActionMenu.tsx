import {
  Button,
  Menu,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import type { ReactNode } from "react";

export interface ActionMenuProps {
  /** Names the trigger and the menu */
  label: string;
  items: MenuItem[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  icon: ReactNode;
}

/** An icon button with a menu; its open state is the caller's */
export function ActionMenu({
  label,
  items,
  isOpen,
  onOpenChange,
  icon,
}: ActionMenuProps) {
  return (
    <Menu
      items={items}
      label={label}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      align="end"
      hasExternalTrigger
    >
      <Button
        size="sm"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          onOpenChange(!isOpen);
        }}
      >
        {icon}
      </Button>
    </Menu>
  );
}
