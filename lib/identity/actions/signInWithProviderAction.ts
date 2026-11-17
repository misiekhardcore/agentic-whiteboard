"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { formString } from "@/lib/shared/form-data";
import { routes } from "@/lib/shared/routes";

import { isOAuthProvider, startProviderSignIn } from "../authentication";
import { DEFAULT_REDIRECT, safeRedirectTo } from "../redirect";

export async function signInWithProviderAction(formData: FormData): Promise<void> {
  const provider = formString(formData, "provider");
  const redirectTo = safeRedirectTo(formData.get("redirectTo")) ?? DEFAULT_REDIRECT;

  if (!isOAuthProvider(provider)) {
    redirect(`${routes.signIn}?error=invalid_provider`);
  }

  const { url } = await startProviderSignIn({ provider, redirectTo, headers: await headers() });

  redirect(url ?? `${routes.signIn}?error=oauth`);
}
