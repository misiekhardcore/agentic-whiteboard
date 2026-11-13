import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import { safeRedirectTo } from "@/lib/auth-redirect";
import { signInPath } from "@/lib/routes";

import { SignUpForm } from "./sign-up-form";

export const metadata = {
  title: "Create account",
};

// The page reads ?redirectTo, so it renders per request instead of prerendering.
export const instant = false;

export default async function SignUpPage({
  searchParams,
}: PageProps<"/sign-up">) {
  const redirectTo = safeRedirectTo((await searchParams).redirectTo);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Sign up with your email and a password to get started.
        </CardDescription>
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
