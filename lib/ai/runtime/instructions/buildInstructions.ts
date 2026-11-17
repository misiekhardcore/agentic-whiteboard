import type { UiContext } from "./types";

/**
 * The browser sends what the person is looking at, so "rename this" and "open
 * it" do not need a round trip through the workspace list. The text says
 * exactly what the value is worth: a hint, not an authorization.
 */
export function buildInstructions(base: string, uiContext?: UiContext | null): string {
  if (!uiContext) return base;

  const view = uiContext.workspaceId
    ? `The person is on ${uiContext.pathname}, looking at the workspace with id ${uiContext.workspaceId}.`
    : `The person is on ${uiContext.pathname}.`;

  return `${base}

Current view: ${view} Use it to understand what they mean by "this", but treat it as a hint only: it comes from the browser, it is not a permission, and a tool call still decides what exists and what is allowed.`;
}
