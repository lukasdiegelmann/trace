import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, BACKEND_IDS, onSessionExpired, type BackendId } from "@/api";

import {
  AuthContext,
  type AuthValue,
  type BackendSession,
} from "./AuthContext";
import {
  browserSsoDeps,
  signOut as ssoSignOut,
  startSignIn,
  type SsoDeps,
} from "./sso";

async function loadSession(backend: BackendId): Promise<BackendSession> {
  try {
    const me = await api[backend].me();
    return me.user
      ? { state: "signed-in", user: me.user }
      : { state: "signed-out", isExpired: false };
  } catch {
    return { state: "unavailable" };
  }
}

async function loadSessions(): Promise<Record<BackendId, BackendSession>> {
  const entries = await Promise.all(
    BACKEND_IDS.map(
      async (backend) => [backend, await loadSession(backend)] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<BackendId, BackendSession>;
}

export interface AuthProviderProps {
  children: ReactNode;
  /** For tests */
  deps?: SsoDeps;
}

export function AuthProvider({ children, deps }: AuthProviderProps) {
  const [sessions, setSessions] = useState<AuthValue["sessions"]>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [signOutFailed, setSignOutFailed] = useState<BackendId[]>([]);

  const refresh = useCallback(async () => {
    setSessions(await loadSessions());
  }, []);

  useEffect(() => {
    let isCurrent = true;
    void loadSessions().then((loaded) => {
      if (isCurrent) setSessions(loaded);
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(
    () =>
      onSessionExpired((backend) => {
        setSessions((previous) =>
          previous
            ? {
                ...previous,
                [backend]: { state: "signed-out", isExpired: true },
              }
            : previous,
        );
      }),
    [],
  );

  const signedOut = useMemo(
    () =>
      sessions
        ? BACKEND_IDS.filter(
            (backend) => sessions[backend].state === "signed-out",
          )
        : [],
    [sessions],
  );

  const signIn = useCallback(
    async (next: string) => {
      setError(null);
      setIsRedirecting(true);
      try {
        await startSignIn(signedOut, next, deps ?? browserSsoDeps());
      } catch (caught) {
        setIsRedirecting(false);
        setError(caught instanceof Error ? caught : new Error(String(caught)));
      }
    },
    [deps, signedOut],
  );

  const signOut = useCallback(async () => {
    setSignOutFailed([]);
    setIsRedirecting(true);
    for (const backend of BACKEND_IDS) api[backend].setCsrfToken(null);
    const outcome = await ssoSignOut(deps ?? browserSsoDeps());
    if (outcome.kind === "incomplete") {
      // Still signed in there: stay, say so, and let the user try again.
      setIsRedirecting(false);
      setSignOutFailed(outcome.failed);
    }
  }, [deps]);

  const value = useMemo<AuthValue>(
    () => ({
      sessions,
      signedOut,
      signIn,
      signOut,
      refresh,
      isRedirecting,
      error,
      signOutFailed,
    }),
    [
      sessions,
      signedOut,
      signIn,
      signOut,
      refresh,
      isRedirecting,
      error,
      signOutFailed,
    ],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
