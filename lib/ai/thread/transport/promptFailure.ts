export type PromptFailure = {
  message: string;
  limitReached: boolean;
};

/**
 * The API answers refusals with `{ error, limitReached? }`, and the transport
 * throws that body verbatim as the error message.
 */
export function promptFailure(error: Error): PromptFailure {
  try {
    const parsed = JSON.parse(error.message) as {
      error?: unknown;
      limitReached?: unknown;
    };
    if (typeof parsed.error === "string") {
      return {
        message: parsed.error,
        limitReached: parsed.limitReached === true,
      };
    }
  } catch {
    // Not a JSON body: fall through to the generic message.
  }

  return {
    message: "The agent could not answer that prompt. Try again.",
    limitReached: false,
  };
}
