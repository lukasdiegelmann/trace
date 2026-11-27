/* eslint-disable @typescript-eslint/naming-convention -- the backend's fields */
import { api } from "@/api";

export interface ExerciseSource {
  id: string;
  name: string;
  description?: string;
  requiresKey?: boolean;
  count: number;
  enabled: boolean;
}

export interface ImportedCatalog {
  id: string;
  name: string;
  count: number;
  enabled: boolean;
}

export interface CatalogExercise {
  id: number;
  name: string;
  source?: string | null;
  is_global?: boolean | number;
  category?: string | null;
  primary_muscles?: string[] | null;
  img_url?: string | null;
}

export interface JsonImportAnswer {
  catalogName: string;
  count: number;
  duplicates?: number;
  skipped?: number;
}

export const catalogApi = {
  sources: () => api.lt.get<ExerciseSource[]>("/exercises/sources/list"),
  toggleSource: (source: string, isOn: boolean) =>
    api.lt.post("/exercises/sources/toggle", { source, enabled: isOn }),
  importSource: (source: string, apiKey?: string) =>
    api.lt.post<{ count: number }>("/exercises/sources/import", {
      source,
      apiKey,
    }),
  clearSource: (source: string) =>
    api.lt.post<{ removed: number }>("/exercises/sources/clear", { source }),
  mediaUrls: () => api.lt.get<{ urls: string[] }>("/exercises/media-urls"),
  exercises: () => api.lt.get<CatalogExercise[]>("/exercises"),
  deleteExercise: (id: number) => api.lt.delete(`/exercises/${id}`),
  deleteCustom: () =>
    api.lt.delete<{ removed: number }>("/exercises/custom/all"),
  catalogs: () => api.lt.get<ImportedCatalog[]>("/exercise-import/catalogs"),
  importJson: (catalogName: string, exercises: unknown[]) =>
    api.lt.post<JsonImportAnswer>("/exercise-import/import-json", {
      catalogName,
      exercises,
    }),
  toggleCatalog: (name: string, isOn: boolean) =>
    api.lt.post("/exercise-import/catalogs/toggle", { name, enabled: isOn }),
  deleteCatalog: (name: string) =>
    api.lt.post<{ removed: number }>("/exercise-import/catalogs/delete", {
      name,
    }),
};

export function customExercises(
  list: readonly CatalogExercise[],
): CatalogExercise[] {
  return list
    .filter((e) => e.source === "custom" && !e.is_global)
    .sort((a, b) => a.name.localeCompare(b.name));
}
