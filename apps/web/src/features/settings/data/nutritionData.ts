import { api } from "@/api";
import { settingsStores } from "@/features/shared/settings";

import type { ActivityRow, DiaryDay } from "../lib/csvExport";
import {
  portableExport,
  toFileFood,
  toFileMeal,
  withImportedCategories,
} from "../lib/portableExport";

type Row = Record<string, unknown>;

export const allDiary = () => api.nt.get<(DiaryDay & Row)[]>("/diary");

export const allActivity = () =>
  api.nt.get<(ActivityRow & Row)[]>("/activity", {
    query: { from: "1900-01-01", to: "2999-12-31" },
  });

async function optional<T>(load: Promise<T[]>): Promise<T[]> {
  try {
    return await load;
  } catch {
    return [];
  }
}

export async function buildPortableExport() {
  const [foods, meals, recipes, diary, activity, fasts, version] =
    await Promise.all([
      api.nt.get<Row[]>("/foods"),
      api.nt.get<Row[]>("/meals"),
      api.nt.get<Row[]>("/meals", { query: { recipes: 1 } }),
      allDiary(),
      optional(allActivity()),
      optional(api.nt.get<Row[]>("/fasts", { query: { limit: 10000 } })),
      api.nt
        .get<{ current?: string }>("/updates/server-status")
        .then((status) => status.current ?? "unknown")
        .catch(() => "unknown"),
    ]);
  await settingsStores.nt.ensureLoaded();
  return portableExport(
    {
      foodList: foods.map(toFileFood),
      meals: meals.map(toFileMeal),
      recipes: recipes.map(toFileMeal),
      diary: diary,
      activity: activity,
      fasts,
      settings: { ...settingsStores.nt.getSnapshot().values },
    },
    version,
  );
}

export async function uploadImage(
  backend: "nt" | "ct" | "lt",
  file: Blob,
  name = "photo.jpg",
): Promise<string> {
  const form = new FormData();
  form.append("file", file, name);
  const { url } = await api[backend].post<{ url: string }>("/upload", form);
  return url;
}

/** Pictures that travelled inside the file are uploaded first */
async function uploadInlineImage(row: Row): Promise<Row> {
  const image = row.imgUrl;
  if (typeof image !== "string" || !image.startsWith("data:")) return row;
  try {
    const blob = await (await fetch(image)).blob();
    return { ...row, imgUrl: await uploadImage("nt", blob) };
  } catch {
    return { ...row, imgUrl: "" };
  }
}

export async function importPortableFile(text: string): Promise<void> {
  const data = JSON.parse(text) as Row;
  const migrate = (rows: unknown) =>
    Promise.all(
      (Array.isArray(rows) ? (rows as Row[]) : []).map(uploadInlineImage),
    );
  const [foodList, meals, recipes] = await Promise.all([
    migrate(data.foodList),
    migrate(data.meals),
    migrate(data.recipes),
  ]);
  await api.nt.post("/data/import", { ...data, foodList, meals, recipes });

  await settingsStores.nt.ensureLoaded();
  if (data.settings && typeof data.settings === "object") {
    await settingsStores.nt.setMany(data.settings);
  }
  const categories = withImportedCategories(
    settingsStores.nt.getSnapshot().values.foodCategories,
    foodList,
  );
  if (categories) {
    settingsStores.nt.set("foodCategories", categories);
    await settingsStores.nt.flush();
  }
}

export async function libraryBarcodes(): Promise<string[]> {
  const foods = await api.nt.get<{ barcode?: string | null }[]>("/foods");
  return foods.flatMap((food) => (food.barcode ? [food.barcode] : []));
}
