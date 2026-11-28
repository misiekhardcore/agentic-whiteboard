import { schema } from "@v2/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { jwt, organization } from "better-auth/plugins";

import { database } from "../database";

import { sendIdentityMail } from "./mail";

export function appOrigin(): string {
  return (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Each provider exists only when both of its credentials do, so a deployment
 * with none configured still boots. Their callback URLs are
 * `<origin>/api/auth/callback/<provider>`.
 */
const socialProviders = {
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
      }
    : {}),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
};

export const auth = betterAuth({
  database: drizzleAdapter(database, { provider: "pg", schema }),
  // Unset locally means better-auth derives development defaults; a deployment
  // must set both values (see `.env.example`).
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: appOrigin(),
  trustedOrigins: [appOrigin()],
  socialProviders,
  account: {
    accountLinking: {
      enabled: true,
      // A provider attaches to an existing person only when the provider has
      // verified the address and the local account has confirmed it too, so
      // signing in with GitHub and with a password reach the same person.
      trustedProviders: ["github", "google"],
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // A reset ends every other session, so a copied cookie stops working.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendIdentityMail({ to: user.email, subject: "Reset your password", url });
    },
  },
  plugins: [
    organization({
      sendInvitationEmail: async ({ id, email, organization }) => {
        await sendIdentityMail({
          to: email,
          subject: `Join ${organization.name}`,
          url: `${appOrigin()}/invite/${id}`,
        });
      },
    }),
    // Ed25519 only. The public half is served as a JWKS at
    // `/api/auth/jwks`; `@v2/identity` verifies what it signs. The payload names
    // the person and the account and never a role, so a token that outlives a
    // role change cannot carry the old one.
    jwt({
      jwks: { keyPairConfig: { alg: "EdDSA", crv: "Ed25519" } },
      jwt: {
        issuer: appOrigin(),
        audience: appOrigin(),
        definePayload: ({ user, session }) => {
          const activeOrganizationId: unknown = session.activeOrganizationId;

          return {
            accountId: typeof activeOrganizationId === "string" ? activeOrganizationId : user.id,
          };
        },
      },
    }),
    // Must stay last: it writes the session cookie from a Server Action.
    nextCookies(),
  ],
});
