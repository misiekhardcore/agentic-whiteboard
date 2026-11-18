"use server";

import { switchTo } from "./internals";

export async function switchAccountAction(formData: FormData): Promise<{ error: string | null }> {
  const output = await switchTo(formData);
  return { error: output.ok ? null : output.error };
}
