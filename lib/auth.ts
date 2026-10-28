import { db } from "@/lib/prisma/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: process.env.AUTH_HAS_CREDENTIALS === "true",
  },
});
