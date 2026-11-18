import { auth } from "../better-auth";

import type { OAuthProvider } from "./types";

/**
 * Starts an OAuth flow. Better Auth returns the provider's authorize URL and
 * stores the state/PKCE cookies through the nextCookies plugin, so the caller
 * only has to send the browser there.
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
        // Better Auth appends ?error=<code> when the provider rejects or the
        // callback fails, so the sign-in page can explain what happened.
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
