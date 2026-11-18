"use server";

import { saveReadAloud } from "./internals";

/**
 * The read aloud toggle. The composer applies the choice optimistically, so a
 * refusal comes back as a value for it to revert the button and explain.
 */
export async function setReadAloudAction(enabled: boolean) {
  return saveReadAloud({ enabled });
}
