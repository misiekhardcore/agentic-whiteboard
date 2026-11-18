import { OAUTH_PROVIDERS } from "./internals";
import type { OAuthProvider } from "./types";

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}
