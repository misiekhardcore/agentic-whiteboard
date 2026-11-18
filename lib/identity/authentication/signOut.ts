import { auth } from "../better-auth";

export async function signOut({ headers }: { headers: Headers }): Promise<void> {
  await auth.api.signOut({ headers });
}
