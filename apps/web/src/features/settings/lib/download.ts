/** Hands the browser a file to save */
export function downloadUrl(url: string, filename?: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename ?? "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadText(
  text: string,
  filename: string,
  type = "text/plain",
): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  downloadUrl(url, filename);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
