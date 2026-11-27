import { auth } from "./auth";

export type OAuthProvider = "github" | "google";

const PROVIDERS: readonly OAuthProvider[] = ["github", "google"];

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (PROVIDERS as readonly string[]).includes(value);
}

/** The providers this deployment has credentials for. */
export function enabledProviders(): OAuthProvider[] {
  return PROVIDERS.filter((provider) =>
    provider === "github"
      ? Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
      : Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  );
}

/**
 * Starts an OAuth flow. better-auth returns the provider's authorize URL and
 * stores the state/PKCE cookies through the `nextCookies` plugin, so the caller
 * only sends the browser there.
 */
export async function startProviderSignIn({
  provider,
  redirectTo,
  headers,
}: {
  provider: OAuthProvider;
  redirectTo: string;
  headers: Headers;
}): Promise<{ url?: string }> {
  try {
    const result = await auth.api.signInSocial({
      body: {
        provider,
        callbackURL: redirectTo,
        // Better Auth appends ?error=<code> when the provider rejects the
        // callback, so the sign-in page can explain what happened.
        errorCallbackURL: "/sign-in",
      },
      headers,
    });

    return { url: result.url };
  } catch (error) {
    console.error(`[identity] ${provider} sign-in could not start:`, error);
    return {};
  }
}
