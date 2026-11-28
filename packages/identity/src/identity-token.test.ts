import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { actorFromClaims, createIdentityVerifier } from "./identity-token";

const ISSUER = "http://localhost:3000";
const AUDIENCE = "http://localhost:3000";

const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
const otherKeys = await generateKeyPair("EdDSA", { crv: "Ed25519" });
const publicJwk = await exportJWK(publicKey);

function jwksFetch(): typeof fetch {
  return () =>
    Promise.resolve(
      Response.json({
        keys: [{ ...publicJwk, kid: "key-1", alg: "EdDSA", use: "sig" }],
      }),
    );
}

function verifier(options: { issuer?: string; audience?: string } = {}) {
  return createIdentityVerifier({
    jwksUrl: `${ISSUER}/api/auth/jwks`,
    fetch: jwksFetch(),
    issuer: options.issuer ?? ISSUER,
    audience: options.audience ?? AUDIENCE,
  });
}

async function token(
  claims: Record<string, unknown> = {},
  {
    key = privateKey,
    kid = "key-1",
    issuer = ISSUER,
    audience = AUDIENCE,
    expiresIn = "5m",
  }: {
    key?: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
    kid?: string;
    issuer?: string;
    audience?: string;
    expiresIn?: number | string;
  } = {},
): Promise<string> {
  const { sub, ...rest } = claims;

  return new SignJWT(rest)
    .setProtectedHeader({ alg: "EdDSA", kid })
    .setSubject(typeof sub === "string" ? sub : "user-1")
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

describe("actorFromClaims", () => {
  it("builds the same actor the web app builds from a session", () => {
    expect(actorFromClaims({ sub: "user-1", accountId: "org-1" })).toEqual({
      type: "user",
      userId: "user-1",
      accountId: "org-1",
    });
  });

  it("drops a role claim instead of carrying it onto the actor", () => {
    expect(actorFromClaims({ sub: "user-1", accountId: "org-1", role: "owner" })).toEqual({
      type: "user",
      userId: "user-1",
      accountId: "org-1",
    });
  });

  it("answers null when a required claim is missing or not a string", () => {
    expect(actorFromClaims({ sub: "user-1" })).toBeNull();
    expect(actorFromClaims({ accountId: "org-1" })).toBeNull();
    expect(actorFromClaims({ sub: "", accountId: "org-1" })).toBeNull();
    expect(actorFromClaims({ sub: 7, accountId: "org-1" })).toBeNull();
  });
});

describe("createIdentityVerifier", () => {
  it("verifies an Ed25519 token against the published JWKS", async () => {
    const actor = await verifier().verify(await token({ sub: "user-1", accountId: "org-1" }));

    expect(actor).toEqual({ type: "user", userId: "user-1", accountId: "org-1" });
  });

  it("answers null for an expired token", async () => {
    const expired = await token({ sub: "user-1", accountId: "org-1" }, { expiresIn: -60 });

    expect(await verifier().verify(expired)).toBeNull();
  });

  it("answers null for a token signed by another key", async () => {
    const foreign = await token(
      { sub: "user-1", accountId: "org-1" },
      { key: otherKeys.privateKey },
    );

    expect(await verifier().verify(foreign)).toBeNull();
  });

  it("answers null for a token minted for another issuer or audience", async () => {
    const otherIssuer = await token(
      { sub: "user-1", accountId: "org-1" },
      { issuer: "https://somebody-else.example" },
    );
    const otherAudience = await token(
      { sub: "user-1", accountId: "org-1" },
      { audience: "https://somebody-else.example" },
    );

    expect(await verifier().verify(otherIssuer)).toBeNull();
    expect(await verifier().verify(otherAudience)).toBeNull();
  });

  it("answers null for a token that names no account", async () => {
    expect(await verifier().verify(await token({ sub: "user-1" }))).toBeNull();
  });

  it("answers null for a malformed token instead of throwing", async () => {
    expect(await verifier().verify("not-a-jwt")).toBeNull();
  });
});
