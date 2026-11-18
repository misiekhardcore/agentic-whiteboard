import { field, quoted, type ToolPresentation } from "@/lib/capabilities/presentation";

/**
 * How a workspace capability reads in the conversation: the action, and what it
 * acted on.
 *
 * Deliberately free of server imports — the thread is a client component, and
 * it must not pull the database in just to label a tool call. The capability
 * definitions use these same functions, so a capability cannot be labelled one
 * way for the model and another for the person.
 */
export const presentCreateWorkspace = (input: unknown): ToolPresentation => ({
  title: "Create workspace",
  subject: quoted(field(input, "name")),
});
