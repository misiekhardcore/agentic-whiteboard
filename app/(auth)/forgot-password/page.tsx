import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import { routes } from "@/lib/routes";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = {
  title: "Reset your password",
};

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we will send you a link to choose a new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
      <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
        <span>Remembered it?</span>
        <Link
          href={routes.signIn}
          className="font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
