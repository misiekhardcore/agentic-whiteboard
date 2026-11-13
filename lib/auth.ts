import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  sendOrganizationInvitationEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/email";

/**
 * Each provider is registered only when both of its credentials are present,
 * so the app still boots with one (or none) configured.
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
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders,
  account: {
    accountLinking: {
      enabled: true,
      // A provider may attach itself to an existing account with the same
      // address when the provider itself verifies that address, and the
      // local account has confirmed it too (the default
      // `requireLocalEmailVerified`).
      trustedProviders: ["github", "google"],
    },
  },
  emailAndPassword: {
    enabled: true,
    // Matches the "at least 8 characters" hint on the sign-up form.
    minPasswordLength: 8,
    sendResetPassword: ({ user, url }) => sendPasswordResetEmail({ user, url }),
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: ({ user, url }) => sendVerificationEmail({ user, url }),
  },
  plugins: [
    organization({
      // Team invitations are sent by us so the link can land on our own
      // accept page, which handles sign-in before accepting.
      sendInvitationEmail: ({ id, email, role, organization, inviter }) =>
        sendOrganizationInvitationEmail({
          to: email,
          organizationName: organization.name,
          inviterName: inviter.user.name || inviter.user.email,
          role: role || "member",
          url: `${(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")}/invite/${id}`,
        }),
    }),
    // Must stay last: it writes the session cookie from Server Actions.
    nextCookies(),
  ],
});
