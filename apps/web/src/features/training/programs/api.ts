import { api } from "@/api";

import { nextCopyName, type TemplateExercise } from "../lib/programs";

/** A program row with what GET /programs adds (server/routes/programs.js) */
export interface Program {
  id: number;
  name: string;
  description?: string | null;
  goal?: string | null;
  created_by?: number | null;
  duration_weeks?: number | null;
  advance_mode?: "calendar" | "sessions" | null;
  on_complete?: "repeat" | "hold" | null;
  is_active?: number | boolean | null;
  is_assigned?: number | boolean | null;
  assigned_by_name?: string | null;
  template_count?: number | null;
  weeks_active?: number | null;
  sessions_in_program?: number | null;
  current_week?: number | null;
}

export interface WorkoutTemplate {
  id: number;
  program_id: number;
  name?: string | null;
  day_label?: string | null;
  exercises?: TemplateExercise[] | null;
}

export interface ProgramWithTemplates extends Program {
  templates?: WorkoutTemplate[];
}

/** A coach's client, as the assign sheet lists them (routes/trainer.js) */
export interface CoachMember {
  id: number;
  username: string;
  full_name?: string | null;
  active_program?: string | null;
}

export function getPrograms(): Promise<Program[]> {
  return api.lt.get<Program[]>("/programs");
}

export function getProgram(id: number | string): Promise<ProgramWithTemplates> {
  return api.lt.get<ProgramWithTemplates>(`/programs/${id}`);
}

export function createProgram(input: object): Promise<Program> {
  return api.lt.post<Program>("/programs", input);
}

export function updateProgram(
  id: number,
  changes: Partial<Program>,
): Promise<Program> {
  return api.lt.put<Program>(`/programs/${id}`, changes);
}

export function deleteProgram(id: number): Promise<unknown> {
  return api.lt.delete(`/programs/${id}`);
}

export function activateProgram(id: number): Promise<unknown> {
  return api.lt.post(`/programs/${id}/activate`);
}

export function deactivatePrograms(): Promise<unknown> {
  return api.lt.post("/programs/deactivate");
}

export function reorderTemplates(
  programId: number,
  ids: number[],
): Promise<unknown> {
  return api.lt.put(`/programs/${programId}/reorder`, { ids });
}

export function createTemplate(input: object): Promise<WorkoutTemplate> {
  return api.lt.post<WorkoutTemplate>("/templates", input);
}

export function deleteTemplate(id: number): Promise<unknown> {
  return api.lt.delete(`/templates/${id}`);
}

export function getCoachMembers(): Promise<CoachMember[]> {
  return api.lt.get<CoachMember[]>("/trainer/members");
}

export function assignProgram(
  programId: number,
  userId: number,
): Promise<unknown> {
  return api.lt.post(`/programs/${programId}/assign`, { user_id: userId });
}

/** Copies a program and its workouts, in order; resolves to the copy */
export async function duplicateProgram(
  program: ProgramWithTemplates,
): Promise<Program> {
  // The names only decide the "(Copy 2)" suffix: without them, "(Copy)".
  const names = await getPrograms()
    .then((list) => list.map((p) => p.name))
    .catch((): string[] => []);
  const source = program.templates ? program : await getProgram(program.id);
  const copy = await createProgram({
    name: nextCopyName(source.name, names),
    description: source.description,
    goal: source.goal,
    duration_weeks: source.duration_weeks,
    advance_mode: source.advance_mode,
    on_complete: source.on_complete,
  });
  for (const template of source.templates ?? []) {
    await createTemplate({
      program_id: copy.id,
      name: template.name,
      day_label: template.day_label,
      exercises: template.exercises,
    });
  }
  return copy;
}
