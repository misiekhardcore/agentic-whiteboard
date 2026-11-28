import type { UserActor } from "@v2/contracts";
import { createRemoteJWKSet, customFetch as joseCustomFetch, jwtVerify } from "jose";
import type { FetchImplementation } from "jose";

/**
 * The claims the app's identity token carries: a person, the account they act
 * in, and one expiry. There is deliberately no role: a role belongs to a
 * membership row, and a token that outlives a role change must not carry the old
 * one. A verifier that finds a `role` claim ignores it.
 */
export type IdentityClaims = {
  /** The person, from the token's subject. */
  sub: string;
  /** The account: an organization's id, or the person's own id. */
  accountId: string;
};

export type FetchLike = typeof globalThis.fetch;

/** Ed25519 only: the app publishes one key type, so a verifier accepts one. */
const SIGNING_ALGORITHMS = ["EdDSA"] as const;

/**
 * The token's claims as the actor every capability takes, or `null` when a
 * required claim is missing. Pure: no clock, no network, no key.
 */
export function actorFromClaims(claims: Record<string, unknown>): UserActor | null {
  const userId = claims.sub;
  const accountId = claims.accountId;

  if (typeof userId !== "string" || userId.length === 0) return null;
  if (typeof accountId !== "string" || accountId.length === 0) return null;

  return { type: "user", userId, accountId };
}

export type IdentityVerifier = {
  /** The actor the token names, or `null` when it is not authentic or expired. */
  verify(token: string): Promise<UserActor | null>;
};

/**
 * A verifier over the app's published JWKS. It holds no session store, no
 * database handle and no framework import: the key set is fetched from the auth
 * service, and an invalid, expired or foreign token is simply `null`.
 *
 * `issuer` and `audience` are checked when given; a deployment configures both
 * with its own origin, so a token minted for another host is refused.
 */
export function createIdentityVerifier({
  jwksUrl,
  fetch,
  issuer,
  audience,
}: {
  jwksUrl: string | URL;
  fetch?: FetchLike;
  issuer?: string;
  audience?: string;
}): IdentityVerifier {
  const keySet = createRemoteJWKSet(
    new URL(jwksUrl),
    fetch === undefined
      ? undefined
      : { [joseCustomFetch]: fetch as unknown as FetchImplementation },
  );

  return {
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, keySet, {
          algorithms: [...SIGNING_ALGORITHMS],
          ...(issuer === undefined ? {} : { issuer }),
          ...(audience === undefined ? {} : { audience }),
        });

        return actorFromClaims(payload);
      } catch {
        // An expired, tampered or foreign token is not an error the caller can
        // act on: it is an unauthenticated request.
        return null;
      }
    },
  };
}
