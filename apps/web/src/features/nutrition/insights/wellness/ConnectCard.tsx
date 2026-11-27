import {
  Button,
  Chip,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Link2 } from "lucide-react";
import type { ReactNode } from "react";

import { SectionCard } from "../components/Panel";

export interface ConnectCardProps {
  icon: ReactNode;
  title: string;
  text: string;
  /** What connecting brings */
  chips?: string[];
  actionText?: string;
  onAction?: () => void;
  isBusy?: boolean;
}

/** What to do while nothing delivers data yet */
export function ConnectCard(props: ConnectCardProps) {
  return (
    <SectionCard>
      <Stack gap={3} align="center">
        <span className="text-accent-text">{props.icon}</span>
        <Text variant="heading" as="h2" align="center">
          {props.title}
        </Text>
        <Text tone="muted" align="center">
          {props.text}
        </Text>
        {props.chips ? (
          <Row gap={2} justify="center" shouldWrap>
            {props.chips.map((chip) => (
              <Chip key={chip} text={chip} />
            ))}
          </Row>
        ) : null}
        {props.actionText && props.onAction ? (
          <Button
            variant="primary"
            size="md"
            text={props.actionText}
            isLoading={props.isBusy}
            onClick={props.onAction}
          >
            <Link2 aria-hidden size={16} />
          </Button>
        ) : null}
      </Stack>
    </SectionCard>
  );
}
