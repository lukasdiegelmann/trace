import { BACKEND_IDS, type BackendId, type BackendUser } from "@/api";
import { useAuth } from "@/auth/AuthContext";

export function isAdminUser(user: BackendUser): boolean {
  return user.role === "admin" || Boolean(user.is_admin);
}

/** The signed-in user of one backend */
export function useBackendUser(backend: BackendId): BackendUser | null {
  const { sessions } = useAuth();
  const session = sessions?.[backend];
  return session?.state === "signed-in" ? session.user : null;
}

/** The backends where the signed-in user is an admin */
export function useAdminBackends(): BackendId[] {
  const { sessions } = useAuth();
  return BACKEND_IDS.filter((backend) => {
    const session = sessions?.[backend];
    return session?.state === "signed-in" && isAdminUser(session.user);
  });
}
