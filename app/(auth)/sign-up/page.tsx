import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import { SignUpForm } from "./sign-up-form";

export const metadata = {
  title: "Create account",
};

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Sign up with your email and a password to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
      <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
        <span>Already have an account?</span>
        <Link
          href="/sign-in"
          className="font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
