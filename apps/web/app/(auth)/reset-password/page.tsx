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

import { ResetPasswordForm } from "./reset-password-form";

import { signInPath } from "@/src/routes";

export const metadata: Metadata = { title: "Choose a new password" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = first(params.token) ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>Setting it signs out every other session.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token} />
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
