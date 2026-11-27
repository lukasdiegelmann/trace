/**
 * The coaching calls of LiftTrace (backends/lifttrace/server/routes:
 * coaching.js, trainer.js, programs.js, set-media.js). The interfaces are the
 * backend's JSON as it comes.
 */
import { api } from "@/api";
import type { WorkoutExercise } from "@/features/training/lib/workout";

export interface Person {
  id: number;
  name: string;
}

export interface ClientPairing {
  id: number;
  status: string;
  coach: Person;
  note: string | null;
  requested_at: string;
  responded_at: string | null;
  unread: number;
}

export interface CoachRequest {
  id: number;
  coach: Person;
  note: string | null;
  requested_at: string;
}

export interface PastPairing {
  id: number;
  coach: Person;
  ended_at: string | null;
  unread: number;
}

export interface CoachCounts {
  pending: number;
  active: number;
  recent: number;
  active_ids?: number[];
  unread?: number;
}

export interface CoachingState {
  role: string | null;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- backend JSON
  can_coach: boolean;
  as_client: ClientPairing | null;
  requests: CoachRequest[];
  past: PastPairing[];
  as_coach: CoachCounts;
  unread: number;
  awaiting: number;
}

export type SentRequestStatus = "pending" | "declined" | "ended";

export interface SentRequest {
  id: number;
  status: SentRequestStatus;
  client: Person;
  note: string | null;
  requested_at: string;
  responded_at: string | null;
  ended_at: string | null;
}

export interface CoachMessage {
  id: number | null;
  uuid: string;
  pairing_id: number;
  sender_id: number | null;
  body: string | null;
  image: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MessageList {
  pairing_id: number;
  status: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- backend JSON
  can_send: boolean;
  messages: CoachMessage[];
  server_time: string;
}

export interface MessagePayload {
  uuid: string;
  body: string | null;
  image?: string;
}

export interface PersonFields {
  full_name?: string | null;
  nickname?: string | null;
  username?: string | null;
}

export interface Member extends PersonFields {
  id: number;
  avatar_url: string | null;
  pairing_id: number | null;
  coached_since: string | null;
  active_program: string | null;
  last_workout_date: string | null;
  week_count: number;
  unread: number;
}

export interface ClientUser extends PersonFields {
  id: number;
  avatar_url: string | null;
  role: string;
}

export interface AssignedProgram {
  id: number;
  name: string;
  goal: string | null;
  active: number;
  assigned_at: string | null;
}

export interface RecentWorkout {
  id: number;
  date: string;
  name: string | null;
  completed: number;
  duration_min: number | null;
  feedback_count: number;
  my_feedback_count: number;
  my_reply_count: number;
  volume: number;
  set_count: number;
  exercise_count: number;
}

export interface MemberOverview {
  user: ClientUser;
  pairing_id: number | null;
  coached_since: string | null;
  active_program: { id: number; name: string; goal: string | null } | null;
  assigned_programs: AssignedProgram[];
  recent_workouts: RecentWorkout[];
  streak: number;
  weight_unit: string | null;
}

export interface CoachFeedback {
  id: number;
  trainer_id: number;
  exercise_idx: number | null;
  exercise_uuid: string | null;
  note: string;
  updated_at: string | null;
  member_reply: string | null;
  member_replied_at: string | null;
  seen_by_member_at: string | null;
  trainer_name: string | null;
  trainer_avatar_url: string | null;
}

export interface LoggedExercise extends WorkoutExercise {
  uuid?: string | null;
  notes?: string | null;
}

export interface MemberWorkout {
  id: number;
  date: string;
  name: string | null;
  notes: string | null;
  duration_min: number | null;
  exercises: LoggedExercise[] | null;
  feedback: CoachFeedback[] | null;
}

export interface FeedbackInput {
  workout_id: number;
  exercise_idx: number | null;
  exercise_uuid?: string | null;
  note: string;
  media_id?: number | null;
  media_time_sec?: number | null;
}

export type PrescriptionStatus = "pending" | "accepted" | "declined";

export interface Prescription {
  id: number;
  date: string | null;
  template_id: number | null;
  name: string | null;
  notes: string | null;
  template_name: string | null;
  program_name: string | null;
  completed: number | null;
  status: PrescriptionStatus | null;
  responded_at: string | null;
}

export interface UnassignedPerson extends PersonFields {
  id: number;
  name?: string | null;
}

export interface CoachActivity {
  id: number;
  member_id: number;
  kind: string;
  workout_id: number | null;
  occurred_at: string | null;
  seen_at: string | null;
  member_full_name: string | null;
  member_username: string | null;
  member_nickname: string | null;
  prescription_date: string | null;
  prescription_name: string | null;
  template_name: string | null;
  program_name: string | null;
  feedback_reply_text: string | null;
  workout_date: string | null;
}

export interface ProgramSummary {
  id: number;
  name: string;
}

export interface ProgramDetail extends ProgramSummary {
  templates?: { id: number; name: string }[];
}

export interface ClipNote {
  id: number;
  body: string;
  author: string | null;
  time_sec: number | null;
  member_reply: string | null;
}

export interface SetClip {
  id: number;
  workout_id: number;
  exercise_uuid: string | null;
  set_uuid: string | null;
  duration_sec: number | null;
  mime: string | null;
  file_url: string;
  note?: ClipNote;
}

export const coachingApi = {
  state: () => api.lt.get<CoachingState | null>("/coaching/state"),
  sentRequests: () => api.lt.get<SentRequest[]>("/coaching/requests"),
  accept: (pairingId: number) =>
    api.lt.post<CoachingState>(`/coaching/pairings/${pairingId}/accept`, {}),
  decline: (pairingId: number) =>
    api.lt.post<CoachingState>(`/coaching/pairings/${pairingId}/decline`, {}),
  endPairing: (pairingId: number, expect?: "pending" | "active") =>
    api.lt.post<CoachingState>(
      `/coaching/pairings/${pairingId}/end`,
      expect ? { expect } : {},
    ),

  /** `path` comes from `conversationPath` */
  messages: (path: string, since: string | null) =>
    api.lt.get<MessageList>(path, since ? { query: { since } } : undefined),
  sendMessage: (path: string, payload: MessagePayload) =>
    api.lt.post<CoachMessage>(path, payload),
  markRead: (path: string) =>
    api.lt.post<{ marked: number }>(`${path}/read`, {}),
  deleteMessage: (uuid: string) =>
    api.lt.delete<CoachMessage>(
      `/coaching/messages/${encodeURIComponent(uuid)}`,
    ),

  members: () => api.lt.get<Member[]>("/trainer/members"),
  overview: (memberId: number) =>
    api.lt.get<MemberOverview>(`/trainer/members/${memberId}`),
  workout: (memberId: number, date: string) =>
    api.lt.get<MemberWorkout | null>(
      `/trainer/members/${memberId}/workout/${encodeURIComponent(date)}`,
    ),
  saveFeedback: (input: FeedbackInput) =>
    api.lt.post<{ ok: unknown }>("/trainer/feedback", input),
  prescriptions: (memberId: number) =>
    api.lt.get<Prescription[]>(`/trainer/members/${memberId}/prescriptions`),
  createPrescription: (
    memberId: number,
    input: { template_id: number; date: string | null; notes: string | null },
  ) => api.lt.post(`/trainer/members/${memberId}/prescriptions`, input),
  updatePrescription: (
    id: number,
    input: { date: string | null; notes: string | null },
  ) => api.lt.put(`/trainer/prescriptions/${id}`, input),
  deletePrescription: (id: number) =>
    api.lt.delete(`/trainer/prescriptions/${id}`),
  unassignedMembers: () =>
    api.lt.get<UnassignedPerson[]>("/trainer/unassigned-members"),
  requestClient: (userId: number, note: string) =>
    api.lt.post<{ status?: string }>(
      `/trainer/members/${userId}`,
      note ? { note } : {},
    ),
  endCoaching: (memberId: number) =>
    api.lt.delete(`/trainer/members/${memberId}`),
  activity: (limit = 50) =>
    api.lt.get<CoachActivity[]>("/trainer/activity", { query: { limit } }),
  /** Without an id: everything */
  markActivitySeen: (id?: number) =>
    api.lt.post("/trainer/activity/seen", id === undefined ? {} : { id }),

  programs: () => api.lt.get<ProgramSummary[]>("/programs"),
  program: (id: number) => api.lt.get<ProgramDetail>(`/programs/${id}`),
  assignProgram: (
    programId: number,
    input: {
      user_id: number;
      start_date?: string | null;
      // eslint-disable-next-line @typescript-eslint/naming-convention -- backend JSON
      make_active: boolean;
    },
  ) => api.lt.post(`/programs/${programId}/assign`, input),
  unassignProgram: (programId: number, userId: number) =>
    api.lt.delete(`/programs/${programId}/assign/${userId}`),

  clips: (workoutId: number) =>
    api.lt.get<{ media?: SetClip[] }>("/set-media", {
      query: { workout_id: workoutId },
    }),
};
