"use server";

import { switchTo } from "./internals";

/** The team page's select keeps its fire-and-forget form contract. */
export async function switchTeamAction(formData: FormData): Promise<void> {
  await switchTo(formData);
}
