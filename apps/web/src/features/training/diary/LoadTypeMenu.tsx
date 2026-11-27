/**
 * The Load Type / Tracked By chooser of the diary's exercise card and the
 * workout editor, ported from LiftTrace `components/ui/LoadTypeMenu.svelte`.
 */
import { Menu, type MenuItem } from "@monocircuit/monolithium/components";
import {
  cloneElement,
  useState,
  type MouseEvent,
  type ReactElement,
} from "react";
import { useTranslation } from "react-i18next";

import type { LoadType, SetType } from "../lib/workoutTypes";

export interface LoadTypeMenuProps {
  loadType: LoadType;
  setType: SetType;
  isRemembered: boolean;
  onRememberChange: (next: boolean) => void;
  onPickLoad: (next: LoadType) => void;
  onPickSetType: (next: SetType) => void;
  /** The trigger, e.g. a Button */
  children: ReactElement;
}

const LOAD_TYPES = ["bilateral", "paired", "unilateral"] as const;
const SET_TYPES = ["reps", "time"] as const;

interface TriggerProps {
  onClick?: (...args: [unknown, MouseEvent?]) => void;
  "aria-haspopup"?: "menu";
  "aria-expanded"?: boolean;
}

export function LoadTypeMenu({
  loadType,
  setType,
  isRemembered,
  onRememberChange,
  onPickLoad,
  onPickSetType,
  children,
}: LoadTypeMenuProps) {
  const { t } = useTranslation("training");
  const [isOpen, setIsOpen] = useState(false);

  // TODO(monolithium): section headers in Menu ("Load Type", "Tracked By")
  const items: MenuItem[] = [
    ...LOAD_TYPES.map((value): MenuItem => ({
      id: `load-${value}`,
      text: t(`workoutEditor.loadMenu.load.${value}`),
      description: t(`workoutEditor.loadMenu.loadHint.${value}`),
      isChecked: loadType === value,
      onSelect: () => {
        onPickLoad(value);
      },
    })),
    ...SET_TYPES.map((value, index): MenuItem => ({
      id: `set-${value}`,
      text: t(`workoutEditor.loadMenu.setType.${value}`),
      description: t(`workoutEditor.loadMenu.setTypeHint.${value}`),
      isChecked: setType === value,
      hasSeparatorBefore: index === 0,
      onSelect: () => {
        onPickSetType(value);
      },
    })),
    {
      id: "remember",
      text: t("workoutEditor.loadMenu.remember"),
      isChecked: isRemembered,
      hasSeparatorBefore: true,
      shouldReturnFocus: false,
      // A toggle: the menu stays open, so the choice can follow
      onSelect: () => {
        onRememberChange(!isRemembered);
        setIsOpen(true);
      },
    },
  ];

  const trigger = children as ReactElement<TriggerProps>;

  return (
    <Menu
      items={items}
      label={t("workoutEditor.loadMenu.title")}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      hasExternalTrigger
    >
      {cloneElement(trigger, {
        onClick: (...args: [unknown, MouseEvent?]) => {
          trigger.props.onClick?.(...args);
          setIsOpen((isShown) => !isShown);
        },
        "aria-haspopup": "menu",
        "aria-expanded": isOpen,
      })}
    </Menu>
  );
}
