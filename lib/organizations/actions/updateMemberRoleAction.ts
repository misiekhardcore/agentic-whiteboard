"use server";

import { changeRole } from "./internals";

export async function updateMemberRoleAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const output = await changeRole(formData);
  return { error: output.ok ? null : output.error };
}
