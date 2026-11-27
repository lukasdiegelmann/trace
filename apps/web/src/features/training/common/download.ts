/**
 * Hands the viewer a file: the system's share sheet where it takes files
 * (phones), otherwise a download.
 */
export async function downloadFile(
  filename: string,
  content: string,
  type: string,
): Promise<void> {
  const file = new File([content], filename, { type });
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  if (
    isTouch &&
    "canShare" in navigator &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: filename });
    } catch (error) {
      // Closing the share sheet is no failure.
      if ((error as Error).name !== "AbortError") throw error;
    }
    return;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
