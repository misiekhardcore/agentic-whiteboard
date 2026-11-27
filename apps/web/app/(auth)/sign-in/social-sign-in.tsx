import { Button } from "@konopskidev/ui/components/button";

import { startOAuthAction } from "../actions";

import { enabledProviders } from "@/src/server/identity/providerSignIn";

const LABELS = {
  github: "Continue with GitHub",
  google: "Continue with Google",
} as const;

/**
 * Only the providers this deployment holds credentials for. A button is a form
 * posting to the server action, so the provider's URL is built server-side and
 * the state cookie is written where it belongs.
 */
export function SocialSignIn({ redirectTo }: { redirectTo?: string }) {
  const providers = enabledProviders();
  if (providers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {providers.map((provider) => (
        <form key={provider} action={startOAuthAction}>
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
          <Button type="submit" variant="outline" className="w-full">
            {LABELS[provider]}
          </Button>
        </form>
      ))}
      <p className="text-center text-xs text-muted-foreground">or</p>
    </div>
  );
}
