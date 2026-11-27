import { Sheet, Stack } from "@monocircuit/monolithium/components";

import type { ExternalFood } from "../lib/externalFoods";
import { PantryItemEditor } from "./PantryItemEditor";

export interface SheetTarget {
  /** Null: a new item */
  itemId: number | null;
  shouldEdit: boolean;
  prefill?: Partial<ExternalFood>;
}

/** The item over the list, so the search and filters stay */
export function PantryItemSheet({
  target,
  onClose,
  onChanged,
}: {
  target: SheetTarget;
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <PantryItemEditor
      key={target.itemId ?? "new"}
      itemId={target.itemId}
      shouldEdit={target.shouldEdit}
      prefill={target.prefill}
      onClose={onClose}
      onChanged={onChanged}
    >
      {({ title, actions, body }) => (
        <Sheet
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) onClose();
          }}
          title={title}
          actions={actions}
          snapPoints={[0.92]}
        >
          <Stack padding={1} className="mx-auto w-full max-w-2xl">
            {body}
          </Stack>
        </Sheet>
      )}
    </PantryItemEditor>
  );
}
