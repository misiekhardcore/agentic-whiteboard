import { toolCatalogue } from "@/lib/capabilities/presentations";

import type { ToolUiPart } from "./internals";
import { humaniseToolName, refusal, toolNameOf } from "./internals";
import type { ToolTrace, ToolTraceStatus } from "./types";

/**
 * A tool part as a readable trace. The SDK moves the same call through states
 * as it streams, so the status here is the one the person should see now.
 */
export function toolTrace(part: ToolUiPart): ToolTrace {
  const name = toolNameOf(part);
  const line = toolCatalogue[name];
  const input = "input" in part ? part.input : undefined;
  const client = line?.client === true;

  const output = part.state === "output-available" ? part.output : undefined;
  const refused = refusal(output);

  let status: ToolTraceStatus;
  let error: string | null = null;
  let hint: string | null = null;

  if (part.state === "output-error") {
    status = "error";
    error = part.errorText;
  } else if (part.state === "output-denied") {
    status = "error";
    error = "You denied this action, so it did not run.";
  } else if (refused) {
    status = "error";
    error = refused.error;
    hint = refused.hint;
  } else if (part.state === "approval-requested") {
    status = "awaiting-approval";
    error = part.approval.requestReason ?? null;
  } else if (part.state === "approval-responded") {
    if (part.approval.approved) {
      status = "running";
    } else {
      status = "error";
      error = part.approval.reason ?? "You denied this action, so it did not run.";
    }
  } else if (part.state === "output-available") {
    status = "done";
  } else if (client && part.state === "input-available") {
    // Nothing runs on the server: the browser opened the target.
    status = "done";
  } else {
    status = "running";
  }

  const shown = line ? line.present(input) : undefined;

  return {
    toolCallId: part.toolCallId,
    name,
    title: shown?.title ?? humaniseToolName(name),
    subject: shown?.subject ?? null,
    status,
    input,
    output,
    error,
    hint,
    approvalId: part.state === "approval-requested" ? part.approval.id : null,
    client,
  };
}
