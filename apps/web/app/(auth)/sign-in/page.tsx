import type { Metadata } from "next";

import { SignInForm } from "./sign-in-form";
import { SocialSignIn } from "./social-sign-in";

export const metadata: Metadata = { title: "Sign in" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const redirectTo = first(params.redirectTo);
  const providerFailed = first(params.error) !== undefined;

  return (
    <div className="flex flex-col gap-4">
      <SocialSignIn redirectTo={redirectTo} />
      <SignInForm redirectTo={redirectTo} providerFailed={providerFailed} />
    </div>
  );
}
