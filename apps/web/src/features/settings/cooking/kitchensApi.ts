/* eslint-disable @typescript-eslint/naming-convention -- the backend's fields */
import { api } from "@/api";

export type KitchenRole = "owner" | "sous" | "member";

export interface Kitchen {
  id: number;
  name: string;
  owner_user_id: number;
  role: KitchenRole;
  auto_share: boolean;
  member_count: number;
  auto_shared_count?: number;
}

export interface KitchenMember {
  user_id: number;
  role: KitchenRole;
  username: string;
  full_name?: string | null;
}

export interface Peer {
  id: number;
  name?: string | null;
  username: string;
}

export interface AutoShareAnswer {
  enabled: boolean;
  recipes?: number;
  added?: number;
}

export const kitchensApi = {
  list: () => api.ct.get<Kitchen[]>("/kitchens"),
  peers: () => api.ct.get<Peer[]>("/auth/users/list"),
  create: (name: string) => api.ct.post("/kitchens", { name }),
  members: (id: number) =>
    api.ct.get<KitchenMember[]>(`/kitchens/${id}/members`),
  autoShare: (id: number, isEnabled: boolean) =>
    api.ct.put<AutoShareAnswer>(`/kitchens/${id}/auto-share`, {
      enabled: isEnabled,
    }),
  setRole: (id: number, userId: number, role: "sous" | "member") =>
    api.ct.put(`/kitchens/${id}/members/${userId}/role`, { role }),
  setOwner: (id: number, userId: number) =>
    api.ct.put(`/kitchens/${id}/owner`, { user_id: userId }),
  invite: (id: number, username: string, role: "sous" | "member") =>
    api.ct.post(`/kitchens/${id}/members`, { username, role }),
  removeMember: (id: number, userId: number) =>
    api.ct.delete(`/kitchens/${id}/members/${userId}`),
  remove: (id: number) => api.ct.delete(`/kitchens/${id}`),
};

/** A picked display name stands for its user; anything else is a user name */
export function resolveInvitee(text: string, peers: readonly Peer[]): string {
  const typed = text.trim();
  const peer = peers.find(
    (candidate) =>
      candidate.username === typed || (candidate.name ?? "") === typed,
  );
  return peer ? peer.username : typed;
}
