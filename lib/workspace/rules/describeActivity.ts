import type { WorkspaceActivityDetails, WorkspaceActivityKind } from "../activity";
import { isWorkspaceStatus, WORKSPACE_STATUS_LABELS } from "../status";

/**
 * One line a reader can scan. `details` is typed loosely because it travels as
 * jsonb, so a value this build does not know still reads as a sentence.
 */
export function describeActivity({
  kind,
  details,
}: {
  kind: WorkspaceActivityKind;
  details: WorkspaceActivityDetails;
}): string {
  switch (kind) {
    case "CREATED":
      return "Created the workspace";
    case "RENAMED":
      return `Renamed from ${details.from ?? "an earlier name"} to ${details.to ?? "a new name"}`;
    case "DESCRIBED":
      if (!details.from && details.to) return "Added a description";
      if (!details.to) return "Cleared the description";
      return "Changed the description";
    case "STAGE_MOVED":
      return `Moved from ${stageLabel(details.from)} to ${stageLabel(details.to)}`;
    case "ARCHIVED":
      return "Archived the workspace";
    case "RESTORED":
      return "Restored the workspace";
    case "DOC_SAVED":
      return "Saved the document";
    case "CANVAS_SAVED":
      return "Saved the canvas";
  }
}

/** A stage label the history can show, even for a value this build does not know. */
function stageLabel(value: string | null | undefined): string {
  return value && isWorkspaceStatus(value) ? WORKSPACE_STATUS_LABELS[value] : "another stage";
}
