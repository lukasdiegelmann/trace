import type { BackendId } from "@/api";
import { ctVersion } from "@/features/shared/settings/definitions/ct";
import { ltVersion } from "@/features/shared/settings/definitions/lt";
import { ntVersion } from "@/features/shared/settings/definitions/nt";

/**
 * The versions of the three apps Trace is built for and deployed with (the
 * submodules). A server tells its own only to admins.
 */
export const APP_VERSIONS: Record<BackendId, string> = {
  nt: ntVersion,
  ct: ctVersion,
  lt: ltVersion,
};
