import { FieldSeparator } from "@konopskidev/ui/components/field";

import { startOAuthAction } from "../actions";

import { ProviderButton } from "./provider-button";

import { enabledProviders } from "@/src/server/identity/providerSignIn";

/**
 * Only the providers this deployment holds credentials for. A button is a form
 * posting to the server action, so the provider's URL is built server-side and
 * the state cookie is written where it belongs.
 */
export function SocialSignIn({ redirectTo }: { redirectTo?: string }) {
  const providers = enabledProviders();
  if (providers.length === 0) return null;

  return (
    <>
      <div className="flex flex-col gap-3">
        {providers.map((provider) => (
          <form key={provider} action={startOAuthAction}>
            <input type="hidden" name="provider" value={provider} />
            <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
            <ProviderButton provider={provider} />
          </form>
        ))}
      </div>
      <FieldSeparator>or</FieldSeparator>
    </>
  );
}
