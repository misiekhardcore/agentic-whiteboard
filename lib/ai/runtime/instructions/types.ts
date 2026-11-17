import type { z } from "zod";

import type { uiContextSchema } from "./uiContextSchema";

export type UiContext = z.infer<typeof uiContextSchema>;
