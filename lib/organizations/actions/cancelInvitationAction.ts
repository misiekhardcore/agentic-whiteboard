"use server";

import { cancel } from "./internals";

export async function cancelInvitationAction(formData: FormData): Promise<void> {
  await cancel(formData);
}
