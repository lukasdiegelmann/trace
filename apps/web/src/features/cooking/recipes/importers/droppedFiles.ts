/** The files of a drop, folders walked (Chrome, Firefox and Safari) */
async function walk(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file(
        (file) => {
          resolve([file]);
        },
        () => {
          resolve([]);
        },
      );
    });
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const files: File[] = [];
  // A reader answers in portions until an empty one.
  for (;;) {
    const portion = await new Promise<FileSystemEntry[]>((resolve) => {
      reader.readEntries(resolve, () => {
        resolve([]);
      });
    });
    if (portion.length === 0) return files;
    for (const child of portion) files.push(...(await walk(child)));
  }
}

export async function droppedFiles(data: DataTransfer): Promise<File[]> {
  // Entries must be read before the first await empties the transfer.
  const entries = Array.from(data.items, (item) =>
    typeof item.webkitGetAsEntry === "function"
      ? item.webkitGetAsEntry()
      : null,
  );
  const plain = Array.from(data.files);
  if (entries.every((entry) => entry === null)) return plain;
  const files: File[] = [];
  for (const entry of entries) {
    if (entry) files.push(...(await walk(entry)));
  }
  return files;
}
