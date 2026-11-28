"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { routes } from "@/src/routes";
import { signOut } from "@/src/server/identity/authentication";

/** Deleting the session row is the sign-out: a copied cookie has nothing left to match. */
export async function signOutAction(): Promise<void> {
  await signOut({ headers: await headers() });
  redirect(routes.signIn);
}
