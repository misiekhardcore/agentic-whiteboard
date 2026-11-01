import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import { SignInForm } from "./sign-in-form";

export const metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Welcome back. Enter your details to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm />
      </CardContent>
      <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
        <span>No account yet?</span>
        <Link
          href="/sign-up"
          className="font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          Create one
        </Link>
      </CardFooter>
    </Card>
  );
}
