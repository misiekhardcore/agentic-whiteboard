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

import { ResetPasswordForm } from "./reset-password-form";

export const metadata = {
  title: "Choose a new password",
};

// The page reads ?token, so it renders per request instead of prerendering.
export const instant = false;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link expired</CardTitle>
          <CardDescription>
            This password reset link is missing its token, so it cannot be
            used. Reset links only work once and expire after an hour.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center text-sm">
          <Link
            href={routes.forgotPassword}
            className="font-medium text-primary underline underline-offset-4 hover:no-underline"
          >
            Request a new link
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          Pick a password you have not used before.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token} />
      </CardContent>
      <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
        <span>Need another link?</span>
        <Link
          href={routes.forgotPassword}
          className="font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          Start over
        </Link>
      </CardFooter>
    </Card>
  );
}
