import { useAuth } from "@/auth/AuthContext";

export interface CtUser {
  id: number | null;
  isAdmin: boolean;
}

/** The signed-in CookTrace user */
export function useCtUser(): CtUser {
  const session = useAuth().sessions?.ct;
  if (session?.state !== "signed-in") return { id: null, isAdmin: false };
  return {
    id: session.user.id,
    isAdmin: session.user.role === "admin" || Boolean(session.user.is_admin),
  };
}
