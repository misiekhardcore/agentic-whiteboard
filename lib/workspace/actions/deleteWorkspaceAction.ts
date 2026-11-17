"use server";

import { remove } from "./internals";

export async function deleteWorkspaceAction(formData: FormData): Promise<void> {
  await remove(formData);
}
