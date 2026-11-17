import { type UiContext, uiContextSchema } from "@/lib/ai/runtime/instructions";

export /** The view the browser says the person is on; an invalid one is ignored. */
function readUiContext(payload: unknown): UiContext | null {
  if (typeof payload !== "object" || payload === null) return null;
  const parsed = uiContextSchema.safeParse((payload as { uiContext?: unknown }).uiContext);

  return parsed.success ? parsed.data : null;
}
