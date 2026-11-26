export { can, WORKSPACE_ACTIONS } from "./can";
export type { WorkspaceAction, WorkspaceResource } from "./can";
export { readWorkspace } from "./capabilities/read-workspace";
export type { CapabilityContext, WorkspaceReader, WorkspaceRecord } from "./context";
export { defineCapability } from "./define";
export type { AppCapability } from "./define";
export { invoke } from "./invoke";
export { agentCapabilities, capabilities } from "./registry";
export { refusal, success } from "./result";
