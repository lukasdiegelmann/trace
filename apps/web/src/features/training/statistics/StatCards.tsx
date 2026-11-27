import { Panel, Stat } from "@monocircuit/monolithium/components";
import type { ReactNode } from "react";

export interface StatCard {
  label: string;
  value: string;
  hint?: ReactNode;
}

/** A row of key figures */
export function StatCards({ cards }: { cards: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {cards.map((card) => (
        <Panel key={card.label} density="compact">
          <Stat label={card.label} value={card.value} hint={card.hint} />
        </Panel>
      ))}
    </div>
  );
}
