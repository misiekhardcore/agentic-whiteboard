import { field, quoted, type ToolPresentation } from "@/lib/capabilities/presentation";

export const presentUpdateWorkspace = (input: unknown): ToolPresentation => ({
  title: "Update workspace",
  subject: quoted(field(input, "name")),
});
