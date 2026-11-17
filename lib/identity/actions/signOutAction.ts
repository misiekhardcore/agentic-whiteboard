"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { routes } from "@/lib/shared/routes";

import { signOut } from "../authentication";

export async function signOutAction(): Promise<void> {
  await signOut({ headers: await headers() });
  redirect(routes.signIn);
}
