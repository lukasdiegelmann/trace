import { createContext, useContext } from "react";

import type { BackendId, BackendUser } from "@/api";

export type BackendSession =
  | { state: "signed-in"; user: BackendUser }
  | { state: "signed-out"; isExpired: boolean }
  /** The backend didn't answer /me (down, or 5xx) */
  | { state: "unavailable" };

export interface AuthValue {
  /** null while the first /me round is running */
  sessions: Record<BackendId, BackendSession> | null;
  /** Backends that need a sign-in */
  signedOut: BackendId[];
  /** Starts the SSO chain for the signed-out backends */
  signIn: (next: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Asks every backend's /me again */
  refresh: () => Promise<void>;
  /** A sign-in or sign-out redirect is under way */
  isRedirecting: boolean;
  /** The last sign-in start failed */
  error: Error | null;
  /** Backends whose logout failed in the last sign-out; empty when none */
  signOutFailed: BackendId[];
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth needs <AuthProvider>");
  return value;
}
