"use server";

import { archive } from "./internals";

export async function archiveWorkspaceAction(formData: FormData): Promise<void> {
  await archive(formData);
}
