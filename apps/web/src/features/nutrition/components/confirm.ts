import { createContext, useContext } from "react";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  isDangerous?: boolean;
}

export type Confirm = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<Confirm | null>(null);

/** `if (!(await confirm({ title }))) return;` */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm needs <UiProvider>");
  return confirm;
}
