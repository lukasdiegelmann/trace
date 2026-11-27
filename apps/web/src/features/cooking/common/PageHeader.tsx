import { Row, Text } from "@monocircuit/monolithium/components";
import type { ReactNode } from "react";

import { CookingNav } from "./CookingNav";

/** A cooking screen's top: the section tabs, the title and its actions */
export function PageHeader({
  title,
  children,
}: {
  title: string;
  /** The header's buttons */
  children?: ReactNode;
}) {
  return (
    <>
      <CookingNav />
      <Row justify="between" align="center" gap={2} shouldWrap>
        <Text variant="title" as="h1">
          {title}
        </Text>
        <Row gap={2} align="center">
          {children}
        </Row>
      </Row>
    </>
  );
}
