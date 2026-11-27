import { CookbookImportDialog } from "./CookbookImportDialog";
import { FileSourceDialog } from "./FileSourceDialog";
import { PasteImportDialog } from "./PasteImportDialog";
import { UrlImportDialog } from "./UrlImportDialog";

export type ImportKind = "url" | "file" | "cookbook" | "paste";

const DIALOGS = {
  url: UrlImportDialog,
  file: FileSourceDialog,
  cookbook: CookbookImportDialog,
  paste: PasteImportDialog,
};

export interface ImportDialogsProps {
  kind: ImportKind | null;
  onClose: () => void;
  /** Recipes were created; the list should load again */
  onImported: () => void;
}

export function ImportDialogs({ kind, ...props }: ImportDialogsProps) {
  if (!kind) return null;
  const Open = DIALOGS[kind];
  return <Open {...props} />;
}
