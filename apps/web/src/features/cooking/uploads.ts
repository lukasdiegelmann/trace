/** `POST /ct/api/upload` (multipart "file"); answers the stored URL */
import { api } from "@/api";

export async function uploadImage(
  file: Blob,
  name = "photo.jpg",
): Promise<string> {
  const form = new FormData();
  form.append("file", file, name);
  const result = await api.ct.post<{ url: string }>("/upload", form);
  return result.url;
}
