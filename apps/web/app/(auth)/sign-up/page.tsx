import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";
import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "./sign-up-form";

import { signInPath } from "@/src/routes";
import { safeRedirectTo } from "@/src/server/identity/safeRedirectTo";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const params = await searchParams;
  const redirectTo = safeRedirectTo(params.redirectTo);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Your own workspace, signed in on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm redirectTo={redirectTo} />
      </CardContent>
      <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
        <span>Already have an account?</span>
        <Link
          href={signInPath(redirectTo)}
          className="font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
