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

import { SignInForm } from "./sign-in-form";

export const metadata = {
  title: "Sign in",
};

// The page reads ?redirectTo, so it renders per request instead of prerendering.
export const instant = false;

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const redirectTo = safeRedirectTo((await searchParams).redirectTo);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Welcome back. Enter your details to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm redirectTo={redirectTo} />
      </CardContent>
      <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
        <span>No account yet?</span>
        <Link
          href={
            redirectTo
              ? `/sign-up?redirectTo=${encodeURIComponent(redirectTo)}`
              : "/sign-up"
          }
          className="font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          Create one
        </Link>
      </CardFooter>
    </Card>
  );
}
