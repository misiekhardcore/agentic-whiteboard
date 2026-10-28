import { defineContract } from "@prisma/orm-postgres/contract-builder";

export const contract = defineContract({}, ({ field, model, rel }) => {
  const User = model("User", {
    fields: {
      id: field.id.uuidv7String(),
      name: field.text().optional(),
      email: field.text().unique(),
      emailVerified: field.boolean().default(false),
      image: field.text().optional(),
      createdAt: field.temporal.createdAtString(),
      updatedAt: field.temporal.updatedAtString(),
    },
  });

  const Session = model("Session", {
    fields: {
      id: field.id.uuidv7String(),
      expiresAt: field.dateTime(),
      token: field.text(),
      ipAddress: field.text().optional(),
      userAgent: field.text().optional(),
      userId: field.uuidString(),
      createdAt: field.temporal.createdAtString(),
      updatedAt: field.temporal.updatedAtString(),
    },
  });

  const Account = model("Account", {
    fields: {
      id: field.id.uuidv7String(),
      acountId: field.text(),
      providerId: field.text(),
      userId: field.uuidString(),
      accessToken: field.text().optional(),
      refreshToken: field.text().optional(),
      idToken: field.text().optional(),
      accessTokenExpiresAt: field.dateTime().optional(),
      refreshTokenExpiresAt: field.dateTime().optional(),
      scope: field.text().optional(),
      password: field.text().optional(),
      expiresAt: field.dateTime(),
      createdAt: field.temporal.createdAtString(),
      updatedAt: field.temporal.updatedAtString(),
    },
  });

  const Verification = model("Verification", {
    fields: {
      id: field.id.uuidv7String(),
      identifier: field.text(),
      value: field.text(),
      createdAt: field.temporal.createdAtString(),
      updatedAt: field.temporal.updatedAtString(),
    },
  });

  return {
    models: {
      User: User.relations({
        sessions: rel.hasMany(Session, { by: "userId" }),
        accounts: rel.hasMany(Account, { by: "userId" }),
      }),
      Session: Session.relations({
        author: rel.belongsTo(User, { from: "userId", to: "id" }).sql({ fk: { name: "session_userId_fkey" } }),
      }),
      Account: Account.relations({
        author: rel.belongsTo(User, { from: "userId", to: "id" }).sql({ fk: { name: "account_userId_fkey" } }),
      }),
      Verification,
    },
  };
});
