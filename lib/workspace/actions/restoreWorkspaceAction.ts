"use server";

import { restore } from "./internals";

export async function restoreWorkspaceAction(formData: FormData): Promise<void> {
  await restore(formData);
}
