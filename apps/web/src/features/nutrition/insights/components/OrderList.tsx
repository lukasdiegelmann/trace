import {
  Button,
  Checkbox,
  Row,
  Stack,
} from "@monocircuit/monolithium/components";
import { ArrowDown, ArrowUp } from "lucide-react";

import { moveItem } from "../../lib/insights/order";
import { useInsightsT } from "../useInsightsT";

export interface OrderListItem {
  key: string;
  label: string;
  isVisible: boolean;
}

export interface OrderListProps {
  items: OrderListItem[];
  onOrderChange: (keys: string[]) => void;
  onVisibilityChange: (key: string) => void;
}

/** Show, hide and reorder a list of metrics or body stats */
export function OrderList({
  items,
  onOrderChange,
  onVisibilityChange,
}: OrderListProps) {
  const { t } = useInsightsT();
  const keys = items.map((item) => item.key);
  // TODO(monolithium): a sortable (drag to reorder) list; up and down until then.
  return (
    <Stack gap={1} as="ul">
      {items.map((item, index) => (
        <li key={item.key} className="flex items-center justify-between gap-2">
          <Checkbox
            label={item.label}
            checked={item.isVisible}
            onChange={() => {
              onVisibilityChange(item.key);
            }}
          />
          <Row gap={1}>
            <Button
              size="sm"
              isDisabled={index === 0}
              aria-label={t("common.moveUp", { name: item.label })}
              onClick={() => {
                onOrderChange(moveItem(keys, index, -1));
              }}
            >
              <ArrowUp aria-hidden size={16} />
            </Button>
            <Button
              size="sm"
              isDisabled={index === items.length - 1}
              aria-label={t("common.moveDown", { name: item.label })}
              onClick={() => {
                onOrderChange(moveItem(keys, index, 1));
              }}
            >
              <ArrowDown aria-hidden size={16} />
            </Button>
          </Row>
        </li>
      ))}
    </Stack>
  );
}
