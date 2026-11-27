import { ActionList, Sheet } from "@monocircuit/monolithium/components";

import type { Choice } from "./useDialogs";

export interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  actions: Choice[];
  onSelect: (id: string) => void;
}

/** A sheet of actions; choosing one closes it */
export function ActionSheet({
  isOpen,
  onClose,
  title,
  actions,
  onSelect,
}: ActionSheetProps) {
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(isStillOpen) => {
        if (!isStillOpen) onClose();
      }}
      title={title}
    >
      <ActionList
        label={title}
        items={actions.map((action) => ({
          id: action.id,
          text: action.text,
          description: action.description,
          tone: action.isDanger ? "danger" : "default",
          onSelect: () => {
            onClose();
            onSelect(action.id);
          },
        }))}
      />
    </Sheet>
  );
}
