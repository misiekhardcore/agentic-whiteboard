import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentPrompts } from "@/lib/db/schema";

import { isUniqueViolation } from "./internals";
import type { ResumePromptResult } from "./types";

/**
 * Puts an answered prompt back into RUNNING without restarting its clock.
 *
 * A parked prompt waits outside the single-flight index, so another send may
 * have taken the slot while its approval sat unanswered; the resume then hits
 * that index. Reporting `busy` leaves the prompt parked and still answerable
 * instead of failing the request outright.
 */
export async function resumePrompt(promptId: string): Promise<ResumePromptResult> {
  try {
    await db.update(agentPrompts).set({ status: "RUNNING" }).where(eq(agentPrompts.id, promptId));
    return "resumed";
  } catch (error) {
    if (isUniqueViolation(error)) return "busy";
    throw error;
  }
}
