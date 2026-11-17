import type { OAUTH_PROVIDERS } from "./internals";

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
