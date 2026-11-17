"use server";

import { remove } from "./internals";

export async function removeMemberAction(formData: FormData): Promise<void> {
  await remove(formData);
}
