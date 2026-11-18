export const BUSY =
  "The agent is still working on your previous prompt. Stop it or wait for it to finish.";

export const APPROVAL_EXPIRED =
  "That approval is no longer waiting. Send a new prompt to try again.";

export const APPROVAL_MISMATCH =
  "That approval does not match the prompt waiting for it. Reload the dashboard and answer it again.";

export const RETRY_EXPIRED =
  "That prompt is no longer the one to retry. Send it again as a new prompt.";

export const CONVERSATION_MISSING = "That conversation could not be found. Start a new one.";

export const MESSAGE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,100}$/;
