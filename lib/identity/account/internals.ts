import type { auth } from "../better-auth";

export type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
