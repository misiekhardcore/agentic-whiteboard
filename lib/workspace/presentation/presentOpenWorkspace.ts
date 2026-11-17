import { field, quoted, type ToolPresentation } from "@/lib/capabilities/presentation";

export const presentOpenWorkspace = (input: unknown): ToolPresentation => ({
  title: "Open workspace",
  subject: quoted(field(input, "name")),
});
