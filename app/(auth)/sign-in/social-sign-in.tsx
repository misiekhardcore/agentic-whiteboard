"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@konopskidev/ui/components/button";
import { Spinner } from "@konopskidev/ui/components/spinner";

import { signInWithProviderAction } from "@/lib/auth-actions";

export type SocialProvider = "github" | "google";

const LABELS: Record<SocialProvider, string> = {
  github: "Continue with GitHub",
  google: "Continue with Google",
};

function GitHubIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="size-4">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7 0-.7 0-.7 1.2 0 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0C16.9 4.9 18 5.2 18 5.2c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.4 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-4">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M47 24.6c0-1.6-.2-3.1-.4-4.6H24v9h12.9c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 7.1-10.4 7.1-17.6Z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.6a14.4 14.4 0 0 1 0-9.2l-8-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l8-6.2Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-8 6.2C6.5 42.6 14.6 48 24 48Z"
      />
    </svg>
  );
}

function ProviderButton({ provider }: { provider: SocialProvider }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      {pending ? <Spinner /> : provider === "github" ? <GitHubIcon /> : <GoogleIcon />}
      {LABELS[provider]}
    </Button>
  );
}

export function SocialSignIn({
  providers,
  redirectTo,
}: {
  providers: SocialProvider[];
  redirectTo?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {providers.map((provider) => (
        <form key={provider} action={signInWithProviderAction}>
          <input type="hidden" name="provider" value={provider} />
          {redirectTo ? (
            <input type="hidden" name="redirectTo" value={redirectTo} />
          ) : null}
          <ProviderButton provider={provider} />
        </form>
      ))}
    </div>
  );
}
