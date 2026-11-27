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

import { ForgotPasswordForm } from "./forgot-password-form";

import { signInPath } from "@/src/routes";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>We send a single-use link that expires in an hour.</CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
      <CardFooter>
        <Link
          href={signInPath()}
          className="text-sm font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
