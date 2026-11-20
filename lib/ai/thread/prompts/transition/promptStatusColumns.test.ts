import { describe, expect, it } from "vitest";

import { promptStatusColumns } from "./promptStatusColumns";

/**
 * The prompt row's life is one rule: a status and the clock and error columns
 * that status implies. Every writer used to choose those columns itself, so the
 * same transition could be written two ways; these cases pin the rule down.
 */
describe("the columns a prompt transition writes", () => {
  const now = new Date("2026-11-20T10:00:00.000Z");

  it("starts a queued prompt by opening its clock", () => {
    expect(promptStatusColumns({ transition: "start", now })).toEqual({
      status: "RUNNING",
      startedAt: now,
    });
  });

  it("resumes a parked prompt without restarting its clock", () => {
    expect(promptStatusColumns({ transition: "resume" })).toEqual({ status: "RUNNING" });
  });

  it("reopens a failed prompt by clearing its failure and restarting its clock", () => {
    expect(promptStatusColumns({ transition: "reopen", now })).toEqual({
      status: "RUNNING",
      startedAt: now,
      finishedAt: null,
      error: null,
    });
  });

  it("closes a prompt with the status its stream ended in", () => {
    expect(
      promptStatusColumns({ transition: "finish", status: "COMPLETED", error: null, now }),
    ).toEqual({
      status: "COMPLETED",
      error: null,
      finishedAt: now,
    });
  });

  it("closes a failed prompt with its error", () => {
    expect(
      promptStatusColumns({
        transition: "finish",
        status: "FAILED",
        error: "The model broke.",
        now,
      }),
    ).toEqual({ status: "FAILED", error: "The model broke.", finishedAt: now });
  });

  it("records usage only when the close carries it", () => {
    const usage = { inputTokens: 12 };

    expect(
      promptStatusColumns({ transition: "finish", status: "COMPLETED", error: null, usage, now }),
    ).toEqual({ status: "COMPLETED", error: null, finishedAt: now, usage });
    expect(
      promptStatusColumns({ transition: "finish", status: "COMPLETED", error: null, now }),
    ).not.toHaveProperty("usage");
  });

  it("parks a prompt in the same shape as any other ending", () => {
    expect(
      promptStatusColumns({ transition: "finish", status: "AWAITING_APPROVAL", error: null, now }),
    ).toEqual({ status: "AWAITING_APPROVAL", error: null, finishedAt: now });
  });

  it("retires an orphaned prompt as failed, with the sentence that says why", () => {
    expect(promptStatusColumns({ transition: "retire", error: "It stopped.", now })).toEqual({
      status: "FAILED",
      error: "It stopped.",
      finishedAt: now,
    });
  });

  it("copies a turn into a branch as finished history, with no clock", () => {
    expect(promptStatusColumns({ transition: "history" })).toEqual({ status: "COMPLETED" });
  });
});
