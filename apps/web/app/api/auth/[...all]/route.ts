import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/src/server/identity/auth";

export const { GET, POST } = toNextJsHandler(auth);
