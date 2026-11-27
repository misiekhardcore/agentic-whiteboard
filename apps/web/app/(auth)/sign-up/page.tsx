import type { Metadata } from "next";

import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create an account" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const params = await searchParams;

  return <SignUpForm redirectTo={first(params.redirectTo)} />;
}
